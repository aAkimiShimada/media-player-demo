// 各種ユーティリティ型をいくつか実装している

/**
 * 値の送受信を行う `Messenger` を生成する
 * * 第1引数: 初期値
 * * 戻り値: 生成した `Messenger`
 */
export const createMessenger = initialValue => {
	/** 内部で保持している値 */
	let heldValue = initialValue;

	/** レシーバのリスト */
	let receivers = [];
	// `send` の実装
	const send = value => {
		// 新しい値にセット
		heldValue = value;
		// レシーバを呼び出す
		call();
	};

	// `call` の実装
	const call = () => {
		for (const receiver of receivers) {
			receiver(heldValue);
		}
	};

	// `setReceiver` の実装
	const setReceiver = receiver => {
		receivers.push(receiver);
	};

	// `removeReceiver` の実装
	const removeReceiver = receiver => {
		receivers = receivers.filter(target => target != receiver);
	};
	return {
		send,
		notify: call,
		setReceiver,
		removeReceiver,
		get: () => heldValue
	};
};

/**
 * 複数の非同期処理を1つずつ実行していく `MutexManager` を生成する
 * * 戻り値: 生成した `MutexManager`
 */
export const createMutexManager = () => {
	// 渡された処理が全て完了したら解決する `Promise`
	let promise = Promise.resolve();
	// 処理が終わっているかどうかを示すブール値
	let running = false;
	// `add` の実装
	const add = func => {
		// この処理が終わる時点での `Promise` を用意する
		const promiseOfThis = (async () => {
			// 前までの処理の終了を待つ
			await promise;
			// 実行中のフラグを立てる
			running = true;
			// 当該の処理を実行する
			const output = await func();
			// 実行完了とする
			running = false;
			// `func` の戻り値を返す
			return output;
		})()
		// エラーで終了する場合も実行中のフラグは間違いなくきる
		.catch(error => {
			running = false;
			throw error;
		});

		// 内部で保持する `Promise` を更新する
		promise = promiseOfThis.then(() => {});

		// ここでの `Promise` は返す
		return promiseOfThis;
	};
	return {
		add,
		isRunning: () => running,
		promise: () => promise
	};
};

/**
 * 複数の非同期処理の終了を監視する `TaskManager` を生成する
 * * 戻り値: 生成した `TaskManager`
 */
export const createTaskManager = () => {
	// 完了/エラーの状態を管理するブール値
	let completed = false;
	let error = false;

	/**
	 * 追加された非同期処理の全てを扱う `Promise`
	 * * 初期状態ではすぐ解決する `Promise` になっている
	 */
	let promiseAll = Promise.resolve().then(() => {
		completed = true;
	});
	/**
	 * 追加された全ての非同期処理の中断をまとめて実行する関数
	 * * 初期状態では何もしない
	 */
	let abortAll = () => {};

	// 以下でメソッドを定義

	const add = (task, abort) => {
		// `promiseAll` は新しい `Promise` を含めた形で上書きする
		promiseAll = Promise.all([
		// 既存の `promiseAll` は最後に `complete = true` にするので、 `complete = false` の処理を入れて取り消す
		promiseAll.then(() => {
			completed = false;
		}),
		// 新しい `Promise` の終了も待つようにする
		task])
		// 全てが終わったら改めて `complete = true` にする
		.then(() => {
			completed = true;
		});

		// 中断処理が用意されていたら、こちらも追加する
		if (abort != undefined) {
			// 前までの `abortAll` のバックアップを取って、今回の `abort` も実行するようにして上書きする
			const abortPrevious = abortAll;
			abortAll = () => {
				abortPrevious();
				abort();
			};
		}

		// 元の `Promise` を返す
		return task;
	};

	// 内部の変数をそのまま返すだけ
	const isCompleted = () => completed;
	const hasError = () => error;
	const promise = () => promiseAll;
	const abort = () => {
		// まずは全ての中断処理を実行する
		abortAll();
		// 全ての追加された非同期処理を監視対象から外す (初期状態を代入する)
		promiseAll = Promise.resolve().then(() => {
			completed = true;
		});
		abortAll = () => {};
		error = false;
	};
	return {
		add,
		isCompleted,
		hasError,
		promise,
		abort
	};
};