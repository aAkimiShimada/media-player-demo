// 各種ユーティリティ型をいくつか実装している

/**
 * 値の送受信を行う機能を提供する型
 *
 * 値を `send` 関数で「送る」と、 `setReceiver` 関数で設定したレシーバが呼び出される。また、送られた値は保持されるので、 `get` 関数でいつでも受け取ることができる。
 *
 * 提供されているメソッド
 * * `send` は新しい値をセットし、レシーバを呼び出す。
 * * `notify` は単にレシーバを呼び出す。
 *     * オブジェクトのプロパティを書き換えただけで、オブジェクト自体は変わっていないけれど、変更を通知する必要がある場合に使用できる。
 * * `get` は現在の値を呼び出す。
 * * `setReceiver` はレシーバを追加する。
 * * `removeReceiver` は指定したレシーバを削除する。
 */
export interface Messenger<T> {
	/**
	 * 新しい値を登録し、レシーバを呼び出す
	 */
	send: (value: T) => void;
	/**
	 * レシーバを呼び出す
	 *
	 * 保持している値がオブジェクトや配列で、一部の要素のみを書き換えて、オブジェクト全体が書きかわっていない場合が通知が必要な場合に使用できる。
	 */
	notify: () => void;
	/**
	 * レシーバを追加する
	 */
	setReceiver: (receiver: (value: T) => void) => void;
	/**
	 * 登録されているレシーバを削除する
	 *
	 * 指定したレシーバが存在していなければ何もしない
	 */
	removeReceiver: (receiver: (value: T) => void) => void;
	/**
	 * 現在保持されている値を返す
	 */
	get: () => T;
}

/**
 * 値の送受信を行う `Messenger` を生成する
 * * 第1引数: 初期値
 * * 戻り値: 生成した `Messenger`
 */
export const createMessenger = <T>(initialValue: T): Messenger<T> => {

	/** 内部で保持している値 */
	let heldValue: T = initialValue;

	/** レシーバのリスト */
	let receivers: ((value: T) => void)[] = [];

	type Send = Messenger<T>["send"];
	type SetReceiver = Messenger<T>["setReceiver"];
	type RemoveReceiver = Messenger<T>["removeReceiver"];

	// `send` の実装
	const send: Send = (value) => {
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
	const setReceiver: SetReceiver = (receiver) => {
		receivers.push(receiver);
	};

	// `removeReceiver` の実装
	const removeReceiver: RemoveReceiver = (receiver) => {
		receivers = receivers.filter(target => target != receiver);
	};

	return {
		send, notify: call, setReceiver, removeReceiver,
		get: () => heldValue
	};
};

/**
 * 複数の非同期処理を同時に実行してはいけない場合に、処理を1つずつ実行していく機能を提供する型
 *
 * 提供されているメソッド
 * * `add` は新しい非同期処理を追加する。これは既に実行している処理が全て終了してから実行が開始される。
 * * `isRunning` は現在処理が実行中であるかどうかをブール値で示す。
 * * `promise` は全ての処理が終了した時に解決する `Promise` を返す。
 *
 * 注意
 * * どこかの `Promise` で `reject` が発生すると、それ以降の処理は中断され、 `promise` や `add` の返値の `Promise` 型は `reject` を返すようになる。
 */
export interface MutexManager {
	/**
	 * 非同期関数で定義された処理をキューに追加する
	 *
	 * この非同期関数は既に実行している処理が完了してから呼び出され、 `add` 関数の返す `Promise` は与えた関数の処理が終了してから解決される。
	 * */
	add: <T>(func: () => Promise<T>) => Promise<T>;
	/** 既に処理が実行中であるか否かを示すブール値 */
	isRunning: () => boolean;
	/**
	 * 非同期処理の全てが終了した時に `resolve` / `reject` される `Promise` を返す
	 *
	 * 注意: この関数で  `Promise` を取得後に `add` で新たな監視対象を追加してもこの `Promise` では追跡されない。
	 */
	promise: () => Promise<void>;
}

/**
 * 複数の非同期処理を1つずつ実行していく `MutexManager` を生成する
 * * 戻り値: 生成した `MutexManager`
 */
export const createMutexManager = (): MutexManager => {
	// 渡された処理が全て完了したら解決する `Promise`
	let promise: Promise<void> = Promise.resolve();
	// 処理が終わっているかどうかを示すブール値
	let running: boolean = false;

	type Add = MutexManager["add"];

	// `add` の実装
	const add: Add = (func) => {
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
 * 複数の `Promise` による非同期処理の終了を監視する機能を提供する型
 * * `Promise` を `add` 関数で追加していくことで、追加した全ての非同期処理が終わるのをチェックできる。
 * * また `add` において `Promise` の処理を中断する関数を与えることで、全ての処理をまとめて中止させることもできる。
 *
 * 提供されているメソッド
 * * `add` は監視対象の非同期処理を追加する。合わせて非同期処理の中断処理の関数を与えることで、必要な時はまとめて中断させることもできる。
 * * `isComplete` は全ての非同期処理が終了したかどうかを示すブール値を返す。
 * * `hasError` はどこかでエラーが発生したかどうかを示すブール値を返す。
 * * `promise` は全ての処理が終了した時に解決する `Promise` を返す。
 * * `abort` で全ての処理を中断させることができる。
 *
 * 注意
 * * どこかの `Promise` で `reject` が発生すると `hasError` は必ず `true` を返し、 `promise` も `reject` される。
 * * `abort` は `add` で中断処理を与えた場合にそれらを全て実行する関数である。与えていない非同期処理には何も行わない。
 * * 一度 `abort` を実行すると、全ての非同期処理が中断したものとみなし、監視対象から除外する。
 */
export interface TaskManager {
	/**
	 * 新しい監視対象の非同期処理を追加する
	 * * 第1引数: 非同期処理の `Promise`
	 * * 第2引数 (任意): この非同期処理を中断させることのできる関数
	 * * 戻り値: 第1引数の `Promise`
	 */
	add: <T>(
		task: Promise<T>,
		abort?: (() => void) | undefined
	) => Promise<T>;
	/** 監視対象の非同期処理が全て終わっているかどうかを示すブール値を返す */
	isCompleted: () => boolean;
	/** 監視対象の非同期処理のどこかでエラーが発生したかどうかを示すブール値を返す */
	hasError: () => boolean;
	/**
	 * 監視対象の非同期処理の全てが終了した時に `resolve` / `reject` される `Promise` を返す
	 *
	 * 注意: この関数で  `Promise` を取得後に `add` で新たな監視対象を追加してもこの `Promise` では追跡されない。
	 */
	promise: () => Promise<void>;
	/**
	 * 中断処理を与えた全ての非同期処理に対して処理を中断させる
	 *
	 * この関数の実行後はこれまでに追加された全ての非同期処理を監視対象から外す。
	 */
	abort: () => void;
}

/**
 * 複数の非同期処理の終了を監視する `TaskManager` を生成する
 * * 戻り値: 生成した `TaskManager`
 */
export const createTaskManager = (): TaskManager => {
	// 完了/エラーの状態を管理するブール値
	let completed: boolean = false;
	let error: boolean = false;

	/**
	 * 追加された非同期処理の全てを扱う `Promise`
	 * * 初期状態ではすぐ解決する `Promise` になっている
	 */
	let promiseAll: Promise<void> =
		Promise.resolve()
		.then( () => { completed = true; } );
	/**
	 * 追加された全ての非同期処理の中断をまとめて実行する関数
	 * * 初期状態では何もしない
	 */
	let abortAll = () => {};

	// 以下でメソッドを定義

	type Add = TaskManager["add"];
	type IsCompleted = TaskManager["isCompleted"];
	type HasError = TaskManager["hasError"];
	type Abort = TaskManager["abort"];

	const add: Add = (task, abort) => {
		// `promiseAll` は新しい `Promise` を含めた形で上書きする
		promiseAll =
			Promise.all([
				// 既存の `promiseAll` は最後に `complete = true` にするので、 `complete = false` の処理を入れて取り消す
				promiseAll
				.then( () => { completed = false; } ),
				// 新しい `Promise` の終了も待つようにする
				task
			])
			// 全てが終わったら改めて `complete = true` にする
			.then( () => { completed = true; } );

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
	const isCompleted: IsCompleted = () => completed;
	const hasError: HasError = () => error;
	const promise = () => promiseAll;

	const abort: Abort = () => {
		// まずは全ての中断処理を実行する
		abortAll();
		// 全ての追加された非同期処理を監視対象から外す (初期状態を代入する)
		promiseAll =
			Promise.resolve()
			.then( () => { completed = true; } );
		abortAll = () => {};
		error = false;
	};

	return { add, isCompleted, hasError, promise, abort };
};