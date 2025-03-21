// このファイルでは MSE 関連の各種ユーティリティを実装している

import type { Resolution } from "./consts";
import {
	createMutexManager,
	type TaskManager
} from "./utils";

/**
 * 指定した URL のデータを受け取り、 `ArrayBuffer` として返す
 *
 * 基本的には `fetch` 関数のラッパーである
 *
 * * 第1引数: 取得するデータの URL 文字列
 * * 第2引数 (任意): 非同期の取得操作を監視するタスクマネージャ
 * * 戻り値: 取得したデータの `ArrayBuffer`
 *     * 非同期なので `Promise<ArrayBuffer>` である
 */
export const fetchAsArrayBuffer = (
	url: string,
	taskManager?: TaskManager | undefined
): Promise<ArrayBuffer> => {
	// データを取得する前に、取得を中断する際の処理を用意する
	const abortController = new AbortController();

	// 中断を実行する関数を用意する
	const abort = () => {
		abortController.abort();
	};

	// 指定した URL のデータを取得する
	// 非同期処理なので `Promise` を受け取る
	const fetchPromise =
		fetch(
			url,
			// 中断する場合のシグナルを埋め込む
			{ signal: abortController.signal }
		)
		// 中断した場合の処理
		.catch(error => {
			if (abortController.signal.aborted) {
				console.info(`データ ${url} の取得を中断しました`);
			}
			else {
				console.error(
					`ネットワークエラーでデータ ${url} へのアクセスに失敗しました`,
					error
				);
			}
			throw error;
		});

	// `fetch` による取得後に行う操作を非同期関数として用意して、実行を開始し、 `Promise` として用意する
	const promise = (async () => {
		// `fetch` の取得が完了するのを待つ
		const response = await fetchPromise;

		// ステータスコードが正常でない場合もエラーとする
		if (!response.ok) {
			const message = `データ ${url} の取得に失敗しました (ステータスコード: ${response.status})`;
			console.error(message);
			throw new Error(message);
		}

		// `ArrayBuffer` として受け取る
		const buffer = await response.arrayBuffer();

		return buffer;
	})();

	// タスクマネージャが渡されている場合は、監視対象として追加する
	if (taskManager != undefined) {
		taskManager.add(promise, abort);
	}

	return promise;
};

/**
 * `SourceBuffer` へのバッファの追加•削除を安全に行う関数を提供する型
 * * `SourceBuffer.appendBuffer()` や `SourceBuffer.remove()` によるバッファの追加•削除操作は同一の `SourceBuffer` に対して同時に行うことができない。前の追加•削除操作が確実に完了してから実行する必要がある。
 * * この型に用意されている `appendBuffer` や `remove` は前の操作が全て終わってから進むようにラップされている。
 * * ここで用意されている `appendBuffer` や `remove` と同時に `SourceBuffer` に付帯する `appendBuffer` や `remove` を使用した場合は完了監視がされず、エラーになる。
 * * 内部で `MutexManager` を使用している
 *
 * 提供されているメソッド
 * * `appendBuffer` でバッファの追加ができる
 * * `remove` で指定した範囲のバッファの削除ができる
 * * `updating` は `SourceBuffer` が更新中であるか否かを示すブール値を返す
 */
export interface MutexSourceBuffer {
	/**
	 * 内包する `SourceBuffer` にバッファを追加する。
	 *
	 * この関数は `Promise` を返す。通常はすぐに解決されるが、 `SourceBuffer` が別の `appendBuffer` や `remove` を実行している最中であれば、それが完了してからこの `appendBuffer` を実行した後で解決する。
	 */
	appendBuffer: (buffer: ArrayBuffer) => Promise<void>;
	/**
	 * 内包する `SourceBuffer` のバッファを削除する。
	 *
	 * この関数は `Promise` を返す。通常はすぐに解決されるが、 `SourceBuffer` が別の `appendBuffer` や `remove` を実行している最中であれば、それが完了してからこの `remove` を実行した後で解決する。
	 */
	remove: (start: number, end: number) => Promise<void>;
	/**
	 * 内包する `SourceBuffer` が `appendBuffer` や `remove` により更新中であるかどうかを示すブール値を返す。
	 */
	updating: () => boolean;
}

/**
 * `SourceBuffer` へのバッファの追加•削除を安全に行う `MutexSourceBuffer` を生成する関数
 *
 * * 第1引数: 元となる `SourceBuffer`
 * * 戻り値: 生成した `MutexSourceBuffer`
 */
export const createMutexSourceBuffer = (sourceBuffer: SourceBuffer): MutexSourceBuffer => {
	// ミューテックスの管理を行うオブジェクト
	const mutex = createMutexManager();

	/** 処理の完了を監視する `Promise` をセットする関数 */
	const createUpdateendPromise = (): Promise<void> => {
		return new Promise(resolve => {
			sourceBuffer.addEventListener(
				"updateend",
				() => resolve(),
				{ once: true }
			);
		});
	};

	type AppendBuffer = MutexSourceBuffer["appendBuffer"];
	type Remove = MutexSourceBuffer["remove"];

	// `appendBuffer` の実装
	const appendBuffer: AppendBuffer = (buffer) => {
		return mutex.add(() => {
			// バッファの追加を行う
			sourceBuffer.appendBuffer(buffer);
			// 処理の終了を監視する `Promise` を用意する
			return createUpdateendPromise();
		});
	};

	// `remove` の実装
	const remove: Remove = (start, end) => {
		return mutex.add(() => {
			// バッファの削除を行う
			sourceBuffer.remove(start, end);
			// 処理の終了を監視する `Promise` を用意する
			return createUpdateendPromise();
		});
	};

	return {
		appendBuffer, remove,
		updating: mutex.isRunning
	};
};

/**
 * 一定時間後に関数を実行させるタイマーを提供する型
 * * `setTimeout` や `setInterval` のラッパーであり、タイマー ID の管理などを内部で行なうため、関数を呼び出すだけで実行できる。
 * * また、同時に複数のタイマーが作動しないように設計されており、すでに作動中の状態で新たに作動させようとすると、前のタイマーは停止する。
 *
 * 提供されているメソッド
 * * `start` によりタイマーを開始する。すでにタイマーが作動してたらそちらを停止させてから開始する。
 * * `end` により作動中のタイマーを停止する。
 * * `isRunning` によりタイマーが作動中か否かブール値で返す。
 */
export interface Timer {
	/**
	 * タイマーを開始する
	 *
	 * 既にこのタイマーが作動している場合は、それを終了させてから開始する
	 *
	 * * 第1引数: 実行内容 `() => void`
	 * * 第2引数: 呼び出し周期 (ミリ秒) `number`
	 * * 第3引数: 呼び出し回数 `boolean`
	 *     * `false` なら1回のみ (`setTimeout` に相当)
	 *     * `true` なら繰り返し終了させるまで (`setInterval` に相当)
	 */
	start: (
		action: () => void,
		interval: number,
		isRecursive?: boolean
	) => void;
	/**
	 * タイマーを終了する
	 *
	 * 既に終了している場合は何もしない
	 */
	end: () => void;
	/**
	 * タイマーが作動中かどうかを示すブール値を返す
	 */
	isRunning: () => boolean;
};

/**
 * 単一のタイマーを管理する `Timer` 型を生成する
 * * 戻り値: 生成した `Timer`
 */
export const createTimer = (): Timer => {
	/**
	 * `setTimeout` や `setInterval` の返値となっているタイマーの ID を示す型
	 *
	 * 実装により `number` になっている場合と `NodeJS.Timeout` になっている場合がある。
	 */
	type Id = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;

	/** 作動中のタイマーのデータを管理するオブジェクト */
	type TimerInfo = {
		/** `setTimeout` か `setInterval` か判別する */
		isRecursive: boolean;
		/** `setTimeout` や `setInterval` から返されるタイマーの ID */
		id: Id;
	};
	/** 状態管理用の内部変数 */
	let info: TimerInfo | null = null;

	type Start = Timer["start"];
	type End = Timer["end"];

	// `start` 関数の実装
	const start: Start = (
		action, interval, isRecursive = false
	) => {
		// 既に開始していたら終了させる
		end();
		// 種別で場合分けする
		if (!isRecursive) {
			// `setTimeout` の場合
			const id = setTimeout(() => {
				action();
				// 1回だけ呼び出されるので、呼び出した後にはタイマーが停まったものとする
				end();
			}, interval);
			info = { id, isRecursive: false };
		} else {
			// `setInterval` の場合
			const id = setInterval(action, interval);
			info = { id, isRecursive: true };
		}
	};

	// `end` 関数の実装
	const end: End = () => {
		// 既に終了していたら何もしない
		if (info == null) return;
		// 種別を判定して適切な終了関数を選ぶ
		const clear =
			info.isRecursive ?
			clearInterval : clearTimeout;
		// 終了処理を実行
		clear(info.id);
		// タイマーが作動していない状態として示す
		info = null;
	};

	return {
		start, end,
		isRunning: () => info != null
	};
};



/**
 * ユーザが選択可能な解像度を表す型
 *
 * 通常の解像度の他に「自動」が追加されている
 */
export type ResolutionSelection = Resolution | "auto";

/** ストリーミング中の動画プレーヤーの状態をまとめたオブジェクトの型 */
export type PlayerState = {
	/** 現在の再生位置 (秒) */
	currentTime: number;
	/** 最後に読み込みが完了したセグメントのインデクス番号 */
	lastLoadedSegmentIndex: number;
	/** 次に読み込む予定のセグメントのインデクス番号 */
	nextLoadingSegmentIndex: number;
	/**
	 * 現在の解像度設定
	 * * 未定の場合は `null` になる
	 */
	resolution: Resolution | null;
	/**
	 * オフライン扱いをするかどうか
	 * * セグメントの取得が滞るとオフラインと判定する
	 */
	isOffline: boolean;
};