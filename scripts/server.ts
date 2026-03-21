// このファイルは、サーバーを起動し、制御するためのコードを実装している

import * as path from "node:path";
import * as process from "node:process";
import { setTimeout } from "node:timers/promises";

import express from "express";

import { printLn, color } from "@lib/output";
import { r, regexOr, regexPathJoin, regexGroup } from "@lib/regex";

/** 起動するサーバに関する設定情報の型 */
interface Info {
	/** スロットリングを有効にするか否か */
	throttling: boolean;
	/** 公開ポート */
	port: number;
}



/** このサーバースクリプトのエントリーポイント */
const main = () => {
	const info = getInfo();
	serve(info);
};

/** サーバーが公開するディレクトリのパス */
const rootPath = path.join(__dirname, "../");

/** サーバーのメイン実装 */
const serve = (info: Info) => {
	const exApp = express();

	// 予め定義したパターンに合致しないパスへのアクセスがあったらブロックする
	exApp.use((request, response, next) => {
		if (!allowAccessPattern.test(request.path)) {
			printLn(`${color.red("denied")}:  ${color.dim(request.path)}`);
			response.status(404).end();
		}
		else {
			printLn(`${color.green("allowed")}: ${request.path}`);
			next();
		}
	});

	/** スロットリング開始時刻 */
	const startTime = Date.now();

	/** スロットリングが開始されるまでのウォームアップ期間 (ミリ秒) */
	const warmupMs = 15_000;

	/** 遅延の変動周期 (秒) */
	const cycleSec = 40;

	// カスタマイズ設定を用意する
	exApp.use(async (request, response, next) => {
		// ヘッダーをセット
		response.set({
			"Access-Control-Allow-Origin": "*"
		});

		// スロットリングが無効化されている場合はここで脱ける
		if (!info.throttling) {
			next();
			return;
		}

		// 映像セグメントのパスかどうか判定し、そうでなければここで脱けて、次に進む
		// 映像セグメントのみスロットリングを適用する
		const videoSegment = getInfoOfVideoSegmentPath(request.path);
		if (videoSegment == null) {
			next();
			return;
		}

		// ウォームアップ期間中は遅延なしで応答し、バッファを蓄積させる
		const elapsed = Date.now() - startTime;
		if (elapsed < warmupMs) {
			next();
			return;
		}

		// 遅延させる時間を決定する
		// 時間ベースの正弦波により、リクエストレートに依存しない一定周期で遅延が変動する
		// 解像度が高いほど遅延が大きくなることで、実際のネットワークにおける
		// 高ビットレート = 遅い、低ビットレート = 速い、という状況を模擬する
		// 最低解像度(1)では遅延なし、最高解像度(5)で最大遅延となる
		const maxDelay = 3500;
		const resolutionFactor = (videoSegment.resolution - 1) / 4;
		const wave = (1 + Math.sin(2 * Math.PI * (elapsed / 1000) / cycleSec)) / 2;
		const delay = Math.floor( wave * maxDelay * resolutionFactor );

		// 遅延を実行
		await setTimeout(delay);

		// 次の関数に進む
		next();
	});

	// 基本的には静的ファイルの公開にする
	exApp.use(
		express.static(
			rootPath,
			{ index: "index.html" }
		)
	);

	// サーバを起動
	exApp.listen(info.port, () => {
		console.log(`次のアドレスからサーバにアクセスできます: http://localhost:${info.port}`);
		console.log("終了するにはキーボードで Control + C を押します");
	});
};



/**
 * アクセス可能にするファイルのパターン
 *
 * この条件を満たさないパスのファイルへのアクセスリクエストは全て 404 を返す
 */
const allowAccessPattern = (() => {
	/** `js_src` ディレクトリのパターン */
	const js_src = regexPathJoin([
		"js_src", r`[a-z_]+\.js`
	]);

	/** `resources` ディレクトリのパターン */
	const resources = regexPathJoin([
		"resources",
		regexOr([
			"icon.png",
			"[a-z\-]+\.css"
		])
	]);

	/** セグメント関連のディレクトリのパターン */
	const segments = regexPathJoin([
		regexOr([
			"segments",
			"segments_encrypted"
		]),
		regexOr([ r`audio`, r`video_[1-5]` ]),
		regexOr([
			r`init\.mp4`, r`seg\-[0-9]+\.m4s`,
			r`init\.webm`, r`seg\-[0-9]+\.webm`
		])
	]);

	/** 構成ごとのディレクトリのパターン */
	const mediaItems = regexOr([
		`movie\.mp4`,
		`encrypted\.mp4`,
		segments
	]);

	/** `media` ディレクトリのパターン */
	const media = regexOr([
		regexPathJoin([ "media", mediaItems ]),
		regexPathJoin([ "media", r`[^/]+`, mediaItems ]),
	]);

	/** アクセス可能な全てのパスのパターン */
	const whole = "/" + regexOr([
		"", // 空文字列は http://localhost:8080/ を許可している
		"index.html",
		js_src,
		resources,
		media
	]);

	// 正規表現として構成して返す
	return RegExp(r`^${whole}$`);
})();



/**
 * 映像セグメントのパスから構成要素を取得する関数
 * * 第1引数: パス文字列
 * * 戻り値: 構成要素が入ったデータ (`Info`) or `null`
 *      * `Info` は `{ resolution, segmentIndex }` のエイリアスである。
 *      * 引数が映像セグメントのパスであれば `Info` を、さもなくば `null` を返す。
 */
const getInfoOfVideoSegmentPath = (() => {
	/** パスのパターン */
	const pattern = RegExp(
		regexPathJoin([
			regexOr(["segments", "segments_encrypted"]),
			`video_${regexGroup(
				"resolution", r`[1-5]`
			)}`,
			`seg-${regexGroup(
				"segmentIndex", r`[0-9]+`
			)}${regexOr([ r`\.m4s`, r`\.webm` ])}`,
		])
	);

	/** 正規表現 `pattern` でマッチした時に得られるキャプチャグループ */
	interface Group {
		resolution: string;
		segmentIndex: string;
	}

	/** 映像セグメントのパスから得られる情報 */
	interface Info {
		/** 解像度の番号 */
		resolution: number;
		/** セグメントの番号 */
		segmentIndex: number;
	}

	return (target: string): Info | null => {
		const match = pattern.exec(target);

		// マッチしない場合は抜ける
		if (match == null) return null;

		// キャプチャグループを取得する
		const group = (match.groups as unknown) as Group;

		return {
			resolution: parseInt(group.resolution),
			segmentIndex: parseInt(group.segmentIndex)
		};
	};
})();



/** 設定情報を用意する */
const getInfo = (): Info => {
	// 初期設定
	let throttling: boolean = false;
	let port: number = 8080;

	// コマンドライン引数から設定する
	const args = process.argv.slice(2);
	if ((args.length === 1) && (args[0] === "throttling")) {
		throttling = true;
	}

	return { throttling, port };
};



// `main` を呼び出す
main();