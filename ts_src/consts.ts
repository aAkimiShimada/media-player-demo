// このファイルでは定数の定義をおこなっている

import type { PlayerState } from "./mse_utils";
import type { EncryptionKeys } from "./eme_utils";



/** MSE API の機能の有効/無効を切り替える */
export const enableMSE: boolean = false;

/** EME API の機能の有効/無効を切り替える */
export const enableEME: boolean = false;

/** 解像度の「自動」設定の有効/無効を切り替える */
export const enableAutoResolution: boolean = false;



/** 用意している全ての解像度 */
export const resolutions = [
	"480x270", "640x360", "960x540", "1280x720", "1920x1080"
] as const;
/** 用意している解像度を表す型 */
export type Resolution = typeof resolutions[number];

/** 解像度に対応している番号 */
export const resolutionIndexes = {
	"480x270":   1,
	"640x360":   2,
	"960x540":   3,
	"1280x720":  4,
	"1920x1080": 5,
} as const;
/** 解像度に対応している番号を表す型 */
export type ResIndex = typeof resolutionIndexes[Resolution];



/**
 * 映像データのセグメントの URL を返す関数
 *
 * 解像度の指定と、使用するセグメントの番号を元に適切なセグメントのパスを返す
 * * 第1引数 (`resIndex`): 解像度に対応するインデクス
 *     *  480x270  -> 1
 *     *  640x360  -> 2
 *     *  960x540  -> 3
 *     * 1280x720  -> 4
 *     * 1920x1080 -> 5
 * * 第2引数 (`segmentIndex`): セグメントのインデクス (-1,0,1,2,...)
 * * 戻り値: セグメントのパス
 */
export const getVideoSegmentUrl = (
	resIndex: ResIndex,
	segmentIndex: number
): string => {
	// TODO: これから実装する
	return "media/segments/video_1/seg-0.m4s";
};

/**
 * 音声データのセグメントの URL を返す関数
 *
 * 使用するセグメントの番号を元に適切なセグメントのパスを返す
 * * 第1引数: セグメントのインデクス (-1,0,1,2,...)
 * * 戻り値: セグメントのパス
 */
export const getAudioSegmentUrl = (
	segmentIndex: number
): string => {
	// TODO: これから実装する
	return "media/segments/audio/seg-0.m4s";
};



/**
 * 解像度が「自動」に設定されている場合に、状況に合わせて最適な解像度を選択する
 * * 第1引数: 動画プレイヤーの状態を表すデータ
 *     * `playerState.currentTime`: 現在の再生位置 (先頭からの秒数)
 *     * `playerState.lastLoadedSegmentIndex`: 最後に読み込みが完了したセグメントの番号 (0,1,2,...)
 *     * `playerState.nextLoadingSegmentIndex`: 次に読み込む予定のセグメントの番号 (0,1,2,...)
 *     * `playerState.isOffline`: オフラインと判定されているか否か (`true` / `false`)
 *
 *     ここに挙げた4つの変数のうち、必要なもののみを使って最適な解像度を導き出してください。
 *     決まった正解はないので、各自適切だと思う実装にしてください。
 *
 * * 戻り値: 指定する解像度のインデクス
 *     *  480x270  -> 1
 *     *  640x360  -> 2
 *     *  960x540  -> 3
 *     * 1280x720  -> 4
 *     * 1920x1080 -> 5
 */
export const getOptimalResolution = (
	playerState: PlayerState
): ResIndex => {
	// TODO: これから実装する
	// ヒント: 最大でとりうるバッファの長さ (秒数) は `maxBufferDuration` 変数で規定されている。この値をもとに考えてみよう
	// このままだと常に最も低い解像度で再生されてしまいます
	return 1;
};



/** 暗号化キー */
export const encryptionKeys: EncryptionKeys = {
	video: {
		keyId: "",
		key: ""
	},
	audio: {
		keyId: "",
		key: ""
	}
};



// 動画ファイルのデータ形式

/**
 * 映像部分のコーデック情報も含んだ MIME タイプ
 *
 * 指定の例
 * * `video/mp4; codecs="avc1.64001e"`: H.264 (Main profile) in MP4
 * * `video/mp4; codecs="avc1.42001e"`: H.264 (Baseline profile) in MP4
 * * `video/mp4; codecs="avc1.4d001e"`: H.264 (High profile) in MP4
 * * `video/mp4; codecs="hev1.1.6.L93.B0"`: H.265/HEVC (Main profile) in MP4
 * * `video/mp4; codecs="av01.0.08M.08"`: AV1 in MP4
 * * `video/webm; codecs="av1"`: AV1 in WebM
 * * `video/webm; codecs="vp8"`: VP8 in WebM
 * * `video/mp4; codecs="vp08"`: VP8 in MP4
 * * `video/webm; codecs="vp9"`: VP9 in WebM
 * * `video/mp4; codecs="vp09.00.10.08"`: VP9 in MP4
 */
export const videoMimeType = 'video/mp4; codecs="avc1.64001e"';

/**
 * 音声部分のコーデック情報も含んだ MIME タイプ
 *
 * 指定の例
 * * `audio/mp4; codecs="mp4a.40.2"`: AAC (LC) in MP4
 * * `audio/mp4; codecs="mp4a.40.5"`: HE-AAC in MP4
 * * `audio/mp4; codecs="mp4a.40.29"`: HE-AAC v2 in MP4
 * * `audio/mp4; codecs="ac-3"`: AC-3 in MP4
 * * `audio/mp4; codecs="ec-3"`: E-AC-3 in MP4
 * * `audio/webm; codecs="opus"`: Opus in WebM
 * * `audio/webm; codecs="vorbis"`: Vorbis in WebM
 */
export const audioMimeType = 'audio/mp4; codecs="mp4a.40.2"';



// 使用する動画に合わせて変えるべき設定

/** 1つのセグメントの再生秒数 */
export const segmentDuration = 1.0;

/**
 * 動画全体のセグメントの数
 *
 * これは動画の長さ (秒) を `movieSeconds` としたときに次の式で求められる値にしなければなりません。
 * ```javascript
 * const segmentCount
 *    = Math.ceil( movieSeconds / segmentDuration );
 * ```
 */
export const segmentCount = 238;



// 以下の設定はストリーミングのチューニング用の設定である

/** バッファをとる最大秒数 */
export const maxBufferDuration = 20.0;

/**
 * シーク後の読み込みで予め読み込むセグメントの数
 *
 * この値が小さいとバッファ不足で `waiting` イベントが呼び出される
 */
export const advanceSegmentsAfterSeekEnd = 2;

/**
 * バッファ不足によるバッファ取得を試みた後に予め読み込むセグメントの数
 *
 * この値が小さいと再びバッファ不足に陥り `waiting` イベントが呼び出される
 */
export const advanceSegmentsAfterWaiting = 2;