// このファイルでは、処理に必要な定数値を設定しています

import type { EncryptionKeys } from "./utils";



/** 用意している全ての解像度 */
export const resolutions = [
	"480x270", "640x360", "960x540", "1280x720", "1920x1080"
] as const;

/** 用意している解像度を表す型 */
export type Resolution = typeof resolutions[number];



/** 暗号化キーの設定 */
export const encryptionKeys: EncryptionKeys = {
	video: {
		keyId: "da657d4a15ea5443e810ef134dcab506",
		key: "43bfcb236542e6f3b1797a999e8c1bf5"
	},
	audio: {
		keyId: "3f7556f4ccd9a87f508271a80d242a7d",
		key: "b1b22314e8b3c851a56487da432036a8"
	}
};



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



// 動画ファイルのパスを設定
// 注意: 以下でパスを変更すると、フロントエンド側のコードでパス指定を変更する必要があるのみならず、サーバ起動のスクリプトにおけるフィルタリング設定も変更する必要があります。フィルタリングではリポジトリ内の関係のあるファイル以外へのアクセスはブロックしています。

/** オリジナルの動画ファイルのパス */
export const originalPath = "media/movie.mp4";

/** 中間ファイルのディレクトリのパス */
export const intermediateDirPath = "media/intermediates";

/** セグメント分割したリソースが含まれるディレクトリのパス */
export const segmentsDirPath = "media/segments";

/** 暗号化の上でセグメント分割したリソースが含まれるディレクトリのパス */
export const encryptedSegmentsDirPath = "media/segments_encrypted";

/** DASH を使用する場合のセグメント分割したリソースが含まれるディレクトリのパス */
export const segmentsDashDirPath = "media/segments_dash";

/** DASH を使用する場合の暗号化の上でセグメント分割したリソースが含まれるディレクトリのパス */
export const encryptedSegmentsDashDirPath = "media/segments_encrypted_dash";

/** 暗号化のみを行なった場合の出力先の動画ファイルのパス */
export const encryptedMediaPath = "media/encrypted.mp4";



// コマンド実行に関するオプション

/** コマンドは実際には実行せずに、実行予定のコマンドのみを示す */
export const dryRun: boolean = false;

/** 実行するコマンドの内容を逐一表示する */
export const showCommands: boolean = true;