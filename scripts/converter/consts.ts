// このファイルでは変換処理に必要な定数値を定義して設定している

import type { EncryptionKeys } from "~/types/crypt";
import type { ConvertDescription } from "~/types/convert-description";



/** 処理内容の指定 */
export const convertDescription: ConvertDescription = {
	tool: "shaka",
	runMode: "mse",
	skipPreprocess: false,
	container: "mp4",
	videoCodec: "h264",
	audioCodec: "aac",
	pssh: true,
	piff: false,
	direct: false,
	emitMpd: false,
};

/**
 * 出力データを `media` ディレクトリの直下に置くのではなく、 `media/out_*` ディレクトリに配置する機能の有効化/無効化を切り替える。
 *
 * 構成ごとに別のディレクトリに分けたい場合にはこのオプションを `true` に設定します。
 *
 * 例えばオフにしていると `media/segments` に出力されるセグメントデータがオンにしていると `media/out_shaka_h264_aac/segments` といったディレクトリに出力されるようになる。
 */
export const useOutDirectories: boolean = false;

/**
 * `useOutDirectories` を `true` に設定している場合にカスタムなディレクトリ名を設定できる。
 *
 * 例えば `useCustomOutDirName` に `"my_config"` を指定すると `media/out_my_config` に出力されるようになる。
 *
 * `null` に設定していると、現在のコーデックや使用ツールに合わせて適切な名前を指定する。例えば `media/out_shaka_h264_aac` のようなものである。
 */
export const useCustomOutDirName: string | null = null;



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

/**
 * 映像のフレームレート
 *
 * ここには実際に使用する動画ファイルにおける fps の値を指定してください。
 */
export const videoFramerate = 30;



// 動画ファイルのパスを設定
// 注意: 以下でパスを変更すると、フロントエンド側のコードでパス指定を変更する必要があるのみならず、サーバ起動のスクリプトにおけるフィルタリング設定も変更する必要があります。フィルタリングではリポジトリ内の関係のあるファイル以外へのアクセスはブロックしています。

/** オリジナルの動画ファイルのパス */
export const originalPath = "media/movie.mp4";

/**
 * 出力先のパス
 *
 * 基本的には `useOutDirectories` と `useCustomOutDirName` の設定に合わせて自動的に設定されるが、どうしてもカスタマイズしたい場合は上書きして手動で文字列を指定することもできる。
 */
export const outputPath = (
	!useOutDirectories ? "media" :
	useCustomOutDirName != null ?
	`media/out_${useCustomOutDirName}` :
	`media/out_${convertDescription.tool}_${convertDescription.videoCodec}_${convertDescription.audioCodec}`
);

/** プリプロセスデータの保存されるディレクトリのパス */
export const preprocessedDirPath = "media/intermediates";

/** 中間ファイルのディレクトリのパス */
export const intermediateDirPath = `${outputPath}/intermediates`;

/** セグメント分割したリソースが含まれるディレクトリのパス */
export const segmentsDirPath = `${outputPath}/segments`;

/** 暗号化の上でセグメント分割したリソースが含まれるディレクトリのパス */
export const encryptedSegmentsDirPath = `${outputPath}/segments_encrypted`;

/** 暗号化のみを行なった場合の出力先の動画ファイルのパス (拡張子を除く) */
export const encryptedMediaPath = `${outputPath}/encrypted`;



// コマンド実行に関するオプション

/** コマンドは実際には実行せずに、実行予定のコマンドのみを示す */
export const dryRun: boolean = false;

/** 並列に実行可能な部分もあえて並列で実行しないようにする */
export const disableParallel: boolean = false;

/** 実行するコマンドの内容を逐一表示する */
export const showCommands: boolean = true;