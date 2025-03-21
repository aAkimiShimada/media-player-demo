// このファイルでは MSE でも EME でもないそのほかの細かな関数を用意している

import { LOG, ERROR } from "./log";
import { createMessenger } from "./utils";

/**
 * `video` 要素に含まれる `source` 要素を削除する
 * * 第1引数: `video` 要素の DOM (`HTMLVideoElement`)
 */
export const removeSource = (video: HTMLVideoElement) => {
	/** `source` 要素のリスト */
	const sourceList = video.querySelectorAll("source");
	// 全て削除する
	for (const source of sourceList) {
		/** `source` を含む親要素 (通常は `video` と同一) */
		const parent = source.parentNode;
		parent.removeChild(source);
	}
};

/**
 * `video` 要素に用意されたイベントにハンドラを設定していき、通知を送る
 *
 * MSE や EME に関連するイベントは、それぞれの実装ファイルにおいて登録されるので、ここでは MSE や EME とは直接関わりのないイベントのみを対象とする。
 *
 * * 第1引数: `video` 要素の DOM (`HTMLVideoElement`)
 */
export const registerEventHandlers = (video: HTMLVideoElement) => {
	const events = [
		"canplay", "canplaythrough","ended", "loadeddata", "loadedmetadata", "loadstart", "pause", "play", "progress", "stalled", "suspend"
	];
	events.forEach(eventName => {
		video.addEventListener(eventName, () => {
			LOG(`video 要素から ${eventName} イベントが呼ばれました`, "Event");
		});
	});

	// `error` イベントに関しては別個に扱う
	video.addEventListener("error", () => {
		ERROR([
			"video 要素から error イベントが呼ばれました",
			video.error.message
		].join("\n"), "Event");
	});

	// 解像度の変化を通知する
	video.addEventListener("progress", () => {
		videoSizeMessenger.send({
			width: video.videoWidth,
			height: video.videoHeight
		});
	});
};

/** 再生中の動画のサイズを与えるデータの型 */
export interface VideoSize {
	/** 動画の横方向のピクセル数 */
	width: number;
	/** 動画の縦方向のピクセル数 */
	height: number;
}

/**
 * 現在の解像度が変更されるのを監視するメッセンジャー
 */
export const videoSizeMessenger = createMessenger<VideoSize>({ width: 1920, height: 1080 });
