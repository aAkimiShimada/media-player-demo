// このファイルでは MSE 関連の各種ユーティリティを実装している
import { createMutexManager } from "./utils.js";
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
export const fetchAsArrayBuffer = (url, taskManager) => {
	// データを取得する前に、取得を中断する際の処理を用意する
	const abortController = new AbortController();

	// 中断を実行する関数を用意する
	const abort = () => {
		abortController.abort();
	};

	// 指定した URL のデータを取得する
	// 非同期処理なので `Promise` を受け取る
	const fetchPromise = fetch(url,
	// 中断する場合のシグナルを埋め込む
	{
		signal: abortController.signal
	})
	// 中断した場合の処理
	.catch(error => {
		if (abortController.signal.aborted) {
			console.info(`データ ${url} の取得を中断しました`);
		} else {
			console.error(`ネットワークエラーでデータ ${url} へのアクセスに失敗しました`, error);
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
 * `SourceBuffer` へのバッファの追加•削除を安全に行う `MutexSourceBuffer` を生成する関数
 *
 * * 第1引数: 元となる `SourceBuffer`
 * * 戻り値: 生成した `MutexSourceBuffer`
 */
export const createMutexSourceBuffer = sourceBuffer => {
	// ミューテックスの管理を行うオブジェクト
	const mutex = createMutexManager();

	/** 処理の完了を監視する `Promise` をセットする関数 */
	const createUpdateendPromise = () => {
		return new Promise(resolve => {
			sourceBuffer.addEventListener("updateend", () => resolve(), {
				once: true
			});
		});
	};
	// `appendBuffer` の実装
	const appendBuffer = buffer => {
		return mutex.add(() => {
			// バッファの追加を行う
			sourceBuffer.appendBuffer(buffer);
			// 処理の終了を監視する `Promise` を用意する
			return createUpdateendPromise();
		});
	};

	// `remove` の実装
	const remove = (start, end) => {
		return mutex.add(() => {
			// バッファの削除を行う
			sourceBuffer.remove(start, end);
			// 処理の終了を監視する `Promise` を用意する
			return createUpdateendPromise();
		});
	};
	return {
		appendBuffer,
		remove,
		updating: mutex.isRunning
	};
};

/**
 * 単一のタイマーを管理する `Timer` 型を生成する
 * * 戻り値: 生成した `Timer`
 */
export const createTimer = () => {
	/** 状態管理用の内部変数 */
	let info = null;
	// `start` 関数の実装
	const start = (action, interval, isRecursive = false) => {
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
			info = {
				id,
				isRecursive: false
			};
		} else {
			// `setInterval` の場合
			const id = setInterval(action, interval);
			info = {
				id,
				isRecursive: true
			};
		}
	};

	// `end` 関数の実装
	const end = () => {
		// 既に終了していたら何もしない
		if (info == null) return;
		// 種別を判定して適切な終了関数を選ぶ
		const clear = info.isRecursive ? clearInterval : clearTimeout;
		// 終了処理を実行
		clear(info.id);
		// タイマーが作動していない状態として示す
		info = null;
	};
	return {
		start,
		end,
		isRunning: () => info != null
	};
};