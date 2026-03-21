// このファイルでは Node.js からシェルコマンドを呼び出す処理をラッパーするユーティリティ関数 `exec` を実装している

import {
	spawn,
	type SpawnOptions as ExecOption
} from "node:child_process";

import { color, printLn } from "@lib/output";

import { showCommands, dryRun } from "~/consts";

/**
 * コマンドを実行する
 * * 第1引数: 引数を `string[]` の形式で指定する
 * * 第2引数: Node.js の `spawn` に渡すオプションを指定する
 * * 第3引数: 入出力を出力するかしないか
 * 	* `"inherit"`: そのままターミナルに出力する・ターミナルからの入力を渡す
 * 	* `"discard"`: 入出力を一切外に出さない
 * 	* `null`: 第2引数で渡したオプションをそのまま利用する
 * * 戻り値: オブジェクト
 *     * `promise`: 終了したら解決する `Promise` で、 `Status.Type` による終了状態を返す
 *     * `exited`: `() => boolean` であり、終了したかどうかをブール値で返す
 *     * `abort`: `() => void` であり、プロセスを強制終了させる
 */
export const exec = (
	command: string[],
	options?: ExecOption | undefined,
	stdio: "inherit" | "ignore" | "pipe" | null = "inherit"
): ExecOutput => {

	// コマンド引数の数が足りていない場合はエラーとする
	if (command.length === 0) {
		return {
			promise:
				Promise.resolve().then(() => ({
					status: Status.NotStarted,
					output: null
			})),
			exited: () => true, abort: async () => {}
		};
	}

	// プロセス起動時に渡すオプションを構成する
	const passingOptions: ExecOption = { ...options };
	switch (stdio) {
		case "inherit": {
			passingOptions.stdio = "inherit";
		} break;
		case "ignore": {
			passingOptions.stdio = "ignore";
		} break;
		case "pipe": {
			passingOptions.stdio = ["inherit", "pipe", "inherit"];
		} break;
	}

	/** 実行が開始したかどうかを表すブール値 */
	let isStarted: boolean = false;
	/** 実行が終了したかどうかを表すブール値 */
	let isExited: boolean = false;
	/** ユーザ操作で終了させたかどうかを表すブール値 */
	let isAborted: boolean = false;

	/** 標準出力の内容を格納する文字列 */
	let stdout: string | null = null;

	// 実行内容を出力する設定の場合は出力する
	if (showCommands || dryRun) {
		// コマンドライン引数を一つに繋げた文字列を生成する
		const commandStr = getCommandStr(command, true);
		printLn(`${color.dim(">")} ${commandStr}`);
	}

	// 実際に実行しない場合は、即時に終了したものとして返す
	if (dryRun) {
		return {
			promise:
				Promise.resolve().then(_ => ({
					status: Status.Success,
					output: null
				})),
			exited: () => true,
			abort: () => Promise.resolve()
		};
	}

	// プロセスを起動する
	const process = spawn(
		command[0],
		command.slice(1),
		passingOptions
	);

	// プロセスが開始した際に呼び出されるイベント
	process.addListener("spawn", () => {
		isStarted = true;

		// 標準出力があった場合に受け取るイベント
		process.stdout?.addListener("data", (data) => {
			stdout = (stdout ?? "") + data.toString();
		});
	});

	/** 実行が終了したら解決する `Promise` を用意する */
	const promise: Promise<ExecResult> = new Promise(resolve => {

		// エラーで終了した場合に呼び出されるイベント
		process.addListener("error", () => {
			isExited = true;
			// そもそも開始しなかった場合
			if (!isStarted) resolve({
				status: Status.NotStarted,
				output: stdout
			});
			// 開始したけど他の理由でエラーになった場合
			else resolve({
				status: Status.Error,
				output: stdout
			});
		});

		// 実行が終了した場合に呼び出されるイベント
		process.addListener("exit", (code, signal) => {
			isExited = true;
			// こちらから終了させた場合
			if (isAborted) {
				resolve({
					status: Status.Aborted,
					output: stdout
				});
				return;
			}
			// シグナル終了した場合
			if ((signal != null) || (code == null)) {
				resolve({
					status: Status.Signaled,
					output: stdout
				});
				return;
			}
			// 終了コードが0でない場合
			if (code != 0) {
				resolve({
					status: Status.Failure,
					output: stdout
				});
				return;
			}
			resolve({
				status: Status.Success,
				output: stdout
			});
		});

	});

	// 強制終了の処理
	const abort: ExecOutput["abort"] = () => {
		// まずフラグを建てる
		isAborted = true;

		// タイムアウトのインデクスを管理する
		// `setTimeout` の戻り値の型は通常 `number` なのだが、一部の環境では `NodeJS.Timeout` などのように別の型になっている場合があるので、あえて `Timeout` という型をここで導入している。
		type Timeout = ReturnType<typeof setTimeout>;
		let timeout: Timeout | null = null;

		return new Promise(resolve => {

			// 終了の監視を行う
			process.addListener("exit", () => {
				// タイムアウトは無効化する
				if (timeout != null) {
					clearTimeout(timeout);
					timeout = null;
				}
				resolve();
			});

			// 第1ステップとして SIGINT を送る
			process.kill("SIGINT");

			// 第2ステップとして SIGTERM を送る
			timeout = setTimeout(() => {
				timeout = null;
				process.kill("SIGTERM");

				// 第3ステップとして SIGKILL を送る
				timeout = setTimeout(() => {
					timeout = null;
					process.kill("SIGKILL");
				}, 5000);

			}, 1000);

		});
	};

	return {
		promise, abort,
		exited: () => isExited
	};
};

/**
 * コマンドを実行する `exec` の単純バージョン
 *
 * * プログラム的に中断させたり、出力をキャプチャすることはできない。
 * * エラーがあった場合にはエラーを投げる。
 */
export const execSimple =
async (command: string[]): Promise<void> => {
	const result = await exec(command).promise;

	// 正常終了でなければエラーを投げる
	if (result.status !== Status.Success) {
		throw new Error("Command execution failure");
	}
};

/**
 * コマンドライン引数を表す `string[]` 型のデータを、ターミナルで実行可能な形式として繋がった単一の `string` を返す
 *
 * * この時に引数にスペースなどが入っている場合はわかりやすく変換する
 * * 第2引数に `true` を指定すると、同時にターミナル向けに色付けて出力する
 */
const getCommandStr =
(command: string[], colored?: boolean): string => {
	return command.map((arg, index) => {
		if (/[ "\\]/.test(arg)) {
			const escaped =
				arg
				.replace(/\\/, "\\\\")
				.replace(/\$/, "\\$")
				.replace(/"/g, "\\\"");
			arg = `"${escaped}"`;
		}
		if (colored) {
			arg = (index ? color.cyan : color.cyanBold)(arg);
		}
		return arg;
	}).join(" ");
};

/** 実行したシェルの終了状態を説明する */
export namespace Status {
	/** 正常に終了した場合 */
	export const Success = "success";
	/** 0でない終了コードで終了した場合 */
	export const Failure = "failure";
	/** シグナルを受けて終了した場合 */
	export const Signaled = "signaled";
	/** こちらから強制終了させた場合 */
	export const Aborted = "aborted";
	/** 実行がそもそも開始しなかった場合 */
	export const NotStarted = "not-started";
	/** 他に何かしらのエラーが発生して終了した場合 */
	export const Error = "error";
	/** シェルの終了状態を表す型 */
	export type Type =
		typeof Success | typeof Failure | typeof Signaled | typeof Aborted | typeof NotStarted | typeof Error;
}

/** コマンドを実行する `exec` 関数の出力の型 */
export interface ExecOutput {
	/**
	 * 終了したら解決される `Promise`
	 *
	 * 終了状態を必ず返すため、 `reject` されることはない
	 */
	promise: Promise<ExecResult>;
	/**
	 * シェルの実行が終了したかどうかを表す真偽値を返す
	 */
	exited: () => boolean;
	/**
	 * シェルを強制終了させる
	 *
	 * 最初は `SIGINT` 、1秒後に `SIGTERM` 、5秒後に `SIGKILL` を送信します。
	 */
	abort: () => Promise<void>;
}

/** `exec` 関数により実行したコマンドの状態を表す型 */
export interface ExecResult {
	/** コマンドの実行結果 */
	status: Status.Type;
	/** コマンドの標準出力の内容 */
	output: null | string;
}
