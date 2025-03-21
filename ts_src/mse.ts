// このファイルでは MSE 関連の処理を実装している

import {
	audioMimeType, maxBufferDuration, segmentCount, segmentDuration, videoMimeType,
	resolutionIndexes,
	advanceSegmentsAfterSeekEnd, advanceSegmentsAfterWaiting,
	resolutions,
	type Resolution,
	getVideoSegmentUrl, getAudioSegmentUrl, getOptimalResolution,
	enableAutoResolution,
} from "./consts";
import {
	fetchAsArrayBuffer,
	createMutexSourceBuffer,
	createTimer,
	type ResolutionSelection,
	type PlayerState,
	type MutexSourceBuffer,
} from "./mse_utils";
import {
	createTaskManager,
	type TaskManager,
	createMessenger
} from "./utils";
import { LOG, ERROR } from "./log";



/** ユーザーが選択した解像度の設定を管理するメッセンジャー */
export const resolutionSelectionMessenger = createMessenger<ResolutionSelection>(
	enableAutoResolution ? "auto" : resolutions[0]
);

/** 再生状態に関するデータをまとめた `PlayerState` 型を管理するメッセンジャー */
export const playerStateMessenger = createMessenger<PlayerState>({
	currentTime: 0.0,
	nextLoadingSegmentIndex: 0,
	lastLoadedSegmentIndex: 0,
	resolution: null,
	isOffline: false
});


/**
 * あるデータについて、映像データと音声データの両方をまとめて保持する型
 *
 * `T` として対象のデータ型を指定する
 */
type VideoAudio<T> = [ video: T, audio: T ];
/** 映像チャネルのバッファと音声チャネルのバッファを1つにまとめる型 */
type MutexBuffers = VideoAudio<MutexSourceBuffer>;
/** 映像チャネルのバッファと音声チャネルのバッファを1つにまとめる型 */
type Buffers = VideoAudio<SourceBuffer>;



/**
 * 与えた `video` 要素に対して MSE API を使ったストリーミングのセットアップを行う
 * * 第1引数: `video` 要素の DOM (`HTMLVideoElement`)
 */
export const setupMSE = (video: HTMLVideoElement) => {
	// メディアソース (`video` 要素で再生する内容を管理するオブジェクト) を生成する
	const mediaSource = new MediaSource();

	// `video` 要素で動画データの受け入れ準備が整った時に呼び出すイベントのハンドラ
	// 準備が整った時に動画データの供給を開始する
	// 1回しか呼び出されないようにハンドラを設定する
	mediaSource.addEventListener(
		"sourceopen",
		() => {
			LOG("MediaSource から sourceopen イベントが呼ばれました", "MSE", "Event");
			startStreaming(video, mediaSource);
		},
		{ once: true }
	);

	// メディアソースを `video` 要素から参照できるよう URL を用意する
	const url = URL.createObjectURL(mediaSource);

	// `video` 要素に URL をセットしてストリーミングできるようにする
	video.src = url;
};

/**
 * `video` 要素に動画データを渡し始める
 * * 第1引数: `video` 要素の DOM (`HTMLVideoElement`)
 * * 第2引数: メディアソース (`MediaSource`)
 */
const startStreaming = (
	video: HTMLVideoElement,
	mediaSource: MediaSource
) => {

	/** 映像と音声のバッファーをまとめたもの: `[videoBuffer, audioBuffer]` */
	const buffers: Buffers =
	[videoMimeType, audioMimeType].map(mimeType => {
		// 映像と音声それぞれごとにこのバッファー生成の処理が呼び出される

		// メディアソースからバッファを作成
		const buffer = mediaSource.addSourceBuffer(mimeType);

		// バッファに渡されたセグメントの再生順序のモードを指定する
		buffer.mode = "segments";
			// `mode` には `segments` と `sequence` が指定できる
			// `segments` はセグメントに付帯するタイムスタンプ順で再生する
			// `sequence` はバッファに追加した順でセグメントを再生する

		return buffer;
	}) as Buffers;

	/** バッファーへのセグメントの追加•削除が同時に行えないようにロック機構を導入したもの */
	const mutexBuffers: MutexBuffers =
	buffers.map(buffer => {
		return createMutexSourceBuffer(buffer);
	}) as MutexBuffers;

	/** 再生状態に関するデータをまとめたオブジェクト */
	const playerState = playerStateMessenger.get();

	/** セグメントの取得状況を管理するタスクマネージャ */
	const taskManager = createTaskManager();

	/** 再生が止まってしまった時に、データ取得を周期的に試みるためのタイマー */
	const connectionTrialTimer = createTimer();
	/** 一時停止状態でシークしている時に、シーク操作が終わったことを確認するタイマー */
	const seekEndTimer = createTimer();

	/** 最初のセグメントの取得を行う */
	const initialSegmentFetch = () => {
		// 失敗する場合に備え、失敗したら何回か取得を試みられるように周期的に呼び出す。
		const timer = createTimer();
		timer.start(async () => {
			// 読み込みを試みる
			const isSuccess = await supplyBuffers(
				mutexBuffers,
				taskManager
			);
			if (!isSuccess) return;

			// 問題なくバッファできることが確認できたらタイマーを止める
			timer.end();
			LOG("初期セグメントの取得が完了しました", "MSE");

			// もう1つセグメントを取りに行く
			await supplyBuffers(
				mutexBuffers,
				taskManager
			);

		}, 1000, true);
	};

	/** 現在の再生位置を同期し、新しいセグメントが必要であれば取得する */
	const syncAndLoadIfNeeded = () => {
		// 現在の再生位置を同期する
		playerState.currentTime = video.currentTime;
		// 変更を通知
		playerStateMessenger.notify();

		// 新しいセグメントの取得が必要か確認し、必要であれば取得する
		supplyBuffers(
			mutexBuffers,
			taskManager
		);
	};

	/** 過去のセグメントのバッファは削除する */
	const removePreviousSegment = () => {
		// 映像と音声のバッファを取り出す
		const [videoBuffer, audioBuffer] = mutexBuffers;
		// 現在のセグメントの位置を割り出す
		const currentSegment = Math.floor(playerState.currentTime/segmentDuration);

		// 映像と音声共にバッファの操作が行われておらず、先頭から2つ目以降のセグメントにあたる領域に再生位置がある場合、再生位置から2つ手前までのバッファは削除する
		const notInBeginning = (
			!videoBuffer.updating() &&
			!audioBuffer.updating() &&
			currentSegment > 1
		);
		if (notInBeginning) {
			videoBuffer.remove(0, currentSegment - 1);
			audioBuffer.remove(0, currentSegment - 1);
		}
	};

	/** 取得状況が芳しくない状況で、新しいバッファの取得を試みる */
	const tryFetching = () => {
		// バッファで確保した部分の先頭に動画の再生位置が追いついてくる (差が1秒に満たなくなる) ほど読み込みが止まっているのであればページ全体を再読み込みする
		if (Math.abs(video.duration - video.currentTime) < 1) {
			location.reload();
			return;
		}

		// バッファの取得を試みる
		// 取得に失敗した場合も再挑戦できるように1秒ごとに何回も呼び出す
		connectionTrialTimer.start(async () => {
			// まだ取得を試みている状況であれば、静観する (このループでは何もしない)
			if (!taskManager.isCompleted()) return;

			// 今回取得を試みるセグメントのインデクス
			playerState.nextLoadingSegmentIndex =
				Math.floor(playerState.currentTime/segmentDuration);
			// 変更を通知
			playerStateMessenger.notify();

			// 取得を実行する
			const isSuccess = await supplyBuffers(
				mutexBuffers,
				taskManager
			);

			// 読み込みに問題がなければタイマーを終了させてその先のセグメントもいくらかフェッチする
			if (!isSuccess) return;
			connectionTrialTimer.end();
			let index = 0;
			while (index < advanceSegmentsAfterWaiting) {
				await supplyBuffers(
					mutexBuffers,
					taskManager
				);
				index += 1;
			}
		}, 1000, true);
	};

	/** シーク後に現在位置を同期し、セグメントの取得を開始する */
	const updateAfterSeeking = () => {
		// 現在の再生位置を同期する
		playerState.currentTime = video.currentTime;

		// シークが始まった直後などで、セグメントを取得中のようであればキャンセルする
		taskManager.abort();

		// シークした先が2つ目のセグメントより前であれば、先頭セグメントから始める
		const segment = Math.floor(playerState.currentTime/segmentDuration);
		playerState.nextLoadingSegmentIndex = segment > 1 ? segment - 1 : 0;

		// 変更を通知
		playerStateMessenger.notify();

		// シークエンドタイマーが作動中であれば止める
		seekEndTimer.end();

		// 一時停止中にシークをしていたのであれば、シークしてから少し時間を空けてからセグメントの取得を開始する
		// シークをやめたことは確認できないので、 `seeking` イベントが一定時間呼び出されないことをもってシークが終了したものとみなす
		if (video.paused) {
			seekEndTimer.start(async () => {
				// 読み込みを試みる
				const isSuccess = await supplyBuffers(
					mutexBuffers,
					taskManager
				);

				// 読み込みに問題がなければその先のセグメントもいくらかフェッチする
				if (!isSuccess) return;
				let index = 0;
				while (index < advanceSegmentsAfterSeekEnd) {
					await supplyBuffers(
						mutexBuffers,
						taskManager
					);
					index += 1;
				}
			}, 500, false);
		}
	};

	// 現在の再生位置が変更した時に呼び出される
	video.addEventListener("timeupdate", () => {
		LOG("video 要素から timeupdate イベントが呼ばれました", "MSE", "Event");
		// 再生位置を同期して、取得する
		syncAndLoadIfNeeded();
	});

	// 再生が再開した時に呼び出される
	video.addEventListener("playing", () => {
		LOG("video 要素から playing イベントが呼ばれました", "MSE", "Event");
		// 過去のセグメントは削除する
		removePreviousSegment();
	});

	// 再生できる内容がなくなり、再生が止まってしまった時に呼び出される
	video.addEventListener("waiting", () => {
		LOG("video 要素から waiting イベントが呼ばれました", "MSE", "Event");
		// セグメントの取得を試みる
		tryFetching();
	});

	// シーク (早送り/巻き戻し) が行われている時に呼び出される
	video.addEventListener("seeking", () => {
		LOG("video 要素から seeking イベントが呼ばれました", "MSE", "Event");
		// シークが終わっていれば再生位置を同期してセグメント取得を始める
		updateAfterSeeking();
	});

	// 最初のバッファ取得を行う
	initialSegmentFetch();

};

/**
 * バッファの管理を行う
 *
 * 現在の再生状態を考慮して必要であれば `appendBuffers` を呼び出してバッファにセグメントを追加する
 *
 * * 第1引数: 映像と音声のバッファをまとめたタプル (`[videoBuffer, audioBuffer]`)
 * * 第2引数: セグメントのフェッチ状況を管理するタスクマネージャ
 * * 戻り値: 新しいセグメントの取得に成功した場合や、セグメントの取得は行なっていない場合は `true` を、さもなくば `false` を返す
 */
const supplyBuffers = async (
	buffers: MutexBuffers,
	taskManager: TaskManager
): Promise<boolean> => {
	// 現在の再生状態を取得する
	const playerState = playerStateMessenger.get();

	// 映像の解像度を選択する
	const videoResolution: Resolution = (() => {
		// 現在設定されている解像度を取得する
		const selectedResolution = resolutionSelectionMessenger.get();
		// 解像度が自動になっている場合は、最適な解像度を見つける
		if (selectedResolution === "auto") {
			const resIndex = getOptimalResolution(playerState);
			return resolutions[resIndex-1];
		}
		// 解像度が固定されている場合は、その解像度を選択する
		return selectedResolution;
	})();

	// 現時点の解像度と別の解像度が選択されているか否か
	const differentResolutionSelected = videoResolution !== playerState.resolution;

	// オフラインになっているか、現在と異なる解像度を選択する場合には、初期セグメントを取得する
	if (playerState.isOffline || differentResolutionSelected) {
		// 別のセグメントをダウンロード中であればこの先の作業はしない
		if (!taskManager.isCompleted()) return false;

		// 初期セグメントをバッファへ追加する操作を行う
		const isSuccess = await appendBuffers(
			videoResolution,
			-1,
			buffers, taskManager
		);

		// 正常に読み込まれた場合は、現在の解像度を読み込みできる解像度として記録する
		if (isSuccess) {
			playerState.resolution = videoResolution;
			// 変更を通知
			playerStateMessenger.notify();
		}
		// 読み込みに失敗した場合
		else return false;
	}

	// 直近に読み込もうとしていたセグメントの再生位置
	let loadingPosition = playerState.nextLoadingSegmentIndex * segmentDuration;

	// ここでの処理が終わった時点であるはずのバッファの先頭位置
	const bufferEndPosition = Math.min(
		// 現時点から所定の長さだけ先の位置
		Math.floor(playerState.currentTime) + maxBufferDuration,
		// 動画の末尾の位置
		segmentCount * segmentDuration
	);

	// 現在の再生位置を踏まえると必要なバッファが不足していると感じられたら、不足分のセグメントを不足しなくなるまで取得する
	if (loadingPosition < bufferEndPosition) {
		// 前に読み込もうとしていたセグメントの読み込みを行う
		// 但し処理は非同期で行われる (`Promise` の解決を待たずに抜ける)
		appendBuffers(
			playerState.resolution,
			playerState.nextLoadingSegmentIndex,
			buffers, taskManager
		);
		// 次に読み込む予定のセグメント番号をセットする
		playerState.nextLoadingSegmentIndex += 1;
		// 変更を通知
		playerStateMessenger.notify();
	}

	// 読み込みが正常に終了した、或いは読み込みを行なっていない (問題が発生しなかった)
	return true;
};

/**
 * 映像と音声のバッファの追加を行い、結果から動画プレーヤの状態を更新する
 * * 第1引数: 映像で使用する解像度
 * * 第2引数: セグメントの番号
 * * 第3引数: 追加先のバッファ
 * * 第4引数: セグメントのフェッチ状況を管理するタスクマネージャ
 * * 戻り値: セグメントの取得に成功すれば `true` を、失敗すれば `false` を返す
 *     * 非同期なので `Promise<boolean>`
 */
const appendBuffers = async (
	videoResolution: Resolution,
	segmentIndex: number,
	buffers: MutexBuffers,
	taskManager: TaskManager
): Promise<boolean> => {
	// 現在の再生状態を取得する
	const playerState = playerStateMessenger.get();

	// 映像と音声それぞれのリソースを呼び出す URL を取得する
	const videoSegmentUrl = getVideoSegmentUrl(
		resolutionIndexes[videoResolution],
		segmentIndex
	);
	const audioSegmentUrl = getAudioSegmentUrl(segmentIndex);

	// 映像と音声の両方のセグメントの取得を行う
	const [videoSuccess, audioSuccess] =
		await Promise.all([
			appendSegmentToBuffer(
				videoSegmentUrl,
				buffers[0],
				taskManager
			),
			appendSegmentToBuffer(
				audioSegmentUrl,
				buffers[1],
				taskManager
			)
		]);

	// どちらか一方でもセグメントの取得に失敗している場合はオフラインだと判定する
	if (!videoSuccess || !audioSuccess) {
		playerState.isOffline = true;
		// 読み込もうとしていたセグメント番号を記録する
		if (segmentIndex >= 0) playerState.nextLoadingSegmentIndex = segmentIndex;
		// 変更を通知
		playerStateMessenger.notify();
		return false;
	}
	// 両方ともセグメントの取得に成功している場合
	else {
		playerState.isOffline = false;
		// 読み込みが完了したものとして記録する
		if (segmentIndex >= 0) playerState.lastLoadedSegmentIndex = segmentIndex;
		// 変更を通知
		playerStateMessenger.notify();
		return true;
	}
};

/**
 * 渡された URL の指すセグメントのデータを取得して、渡されたバッファーに追加する
 * * 第1引数: セグメントの  URL
 * * 第2引数: 追加するバッファ
 * * 第3引数: タスクマネージャ
 * * 戻り値: セグメントの取得に成功した場合は `true` 、さもなくば `false` を返す
 */
const appendSegmentToBuffer = async (
	segmentUrl: string,
	mutexSourceBuffer: MutexSourceBuffer,
	taskManager: TaskManager
): Promise<boolean> => {
	try {
		// セグメントをダウンロードし、バッファーとして受け取る
		const buffer = await fetchAsArrayBuffer(segmentUrl, taskManager);
		LOG(`${segmentUrl} を取得しました`, "MSE");

		// バッファーを `SourceBuffer` に追加する
		await mutexSourceBuffer.appendBuffer(buffer);
		LOG(`${segmentUrl} をバッファに追加しました`, "MSE");

		return true;
	}
	catch (_) {
		ERROR(`${segmentUrl} の取得に失敗しました`, "MSE");
		return false;
	}
};