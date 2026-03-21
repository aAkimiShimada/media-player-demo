// このファイルは `ffmpeg` コマンドのラッパー関数 `ffmpeg` を実装している

import { VideoCodec, AudioCodec, Container } from "~/types/convert-description";

import { execSimple } from "~/utils/exec";

/**
 * `ffmpeg` コマンドのラッパー関数
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 *
 * このスクリプトファイルで使いうる処理に飲み対応している
 */
export const ffmpeg =
async (option: FfmpegOption): Promise<void> => {
	// `ffmpeg` に渡す引数を構成
	const args = [
		"ffmpeg",
		"-hide_banner", "-loglevel", "fatal", // 毎回表示される不必要なオプションを非表示にして、処理実行時に出力される内容を減らす (処理の続行が不可能になる内容の場合のみ表示)
		"-y", // 既にファイルが存在していれば上書き
		...inputOption(option.input), // -i
		...rangeOption(option.start, option.end), // -ss, -to
		...videoCodecOption(option.videoCodec), // -vcodec / -vn
		...audioCodecOption(option.audioCodec), // -acodec / -an
	];

	// ビデオの解像度に関するオプションを追加
	if (option.resolution != null) {
		args.push("-s", option.resolution);
	}

	// ビデオに埋め込むラベル表示に関するオプションを追加
	if (option.labelText != null) {
		args.push(...labelingOption(option.labelText));
	}

	// ビデオのキーフレーム処理に関するオプションを追加
	const videoCodec = castAsVideoCodec(option.videoCodec);
	if (option.keyframes != null && videoCodec !== null) {
		const { framerate, durationInSec } = option.keyframes;
		args.push(...keyframeOption(
			videoCodec, framerate, durationInSec
		));
	}
	// フラグメント化に関するオプションを追加
	if (option.fragment && !option.split) {
		args.push(...fragmentOption);
	}

	// 暗号化に関するオプションを追加
	if (option.encryption != null) {
		const { key, keyId: kid } = option.encryption;
		args.push(...encryptionOption(key, kid));
	}

	// 実験機能を有効化するオプションを付加
	args.push(...experimentalOption(option));

	// 出力先に関するオプションを追加
	if (option.split !== true) args.push(option.output);
	else {
		args.push(...dashSegmentOption(
			option.container,
			option.outputInit,
			option.outputMedia,
			option.outputDash,
			option.splitDuration
		));
	}

	// 処理を実行
	await execSimple(args);
};

/** `ffmpeg` 関数に渡すオプションの型 */
export type FfmpegOption = (
	& {
		/**
		 * 入力ファイルのパス
		 * * 配列を与えると複数指定できる
		 */
		input: string | string[];
		/** 出力時のビデオコーデックの指定 */
		videoCodec?: VCodec;
		/** 出力時のオーディオコーデックの指定 */
		audioCodec?: ACodec;
		/** クリッピングの開始位置 (秒) */
		start?: number | null;
		/** クリッピングの終了位置 (秒) */
		end?: number | null;
		/**
		 * フラグメント化の処理を行うか否か
		 * * 同時にセグメント分割を行う場合は指定する必要はあない。指定の有無によらず自動的に行われる。
		 * */
		fragment?: boolean;
		/**
		 * ビデオにキーフレーム調整の処理を入れる場合のオプション
		 * * `null` を指定すると処理を行わない
		 * * ビデオを含まない場合の指定は無効
		 * * ビデオコーデックを明示的に指定しない / `"copy"` に指定した場合は無効
		 */
		keyframes?: FFmpegKeyframesOption | null;
		/**
		 * 暗号化のオプション
		 * * 指定がなければ暗号化は行われない
		 * * 複数のストリームが入っていたとしても、個別に暗号化キーを設定することはできない
		 */
		encryption?: {
			key: string;
			keyId: string;
		};
		/**
		 * ビデオの解像度を指定
		 * * 指定がない場合は現在の解像度を使用する
		 * * ビデオを含まない場合の指定は無効
		 */
		resolution?: `${number}x${number}` | null;
		/**
		 * ビデオに埋め込むラベルを指定
		 * * 指定がない場合はラベルを埋め込む操作を行わない
		 * * ビデオを含まない場合の指定は無効
		 */
		labelText?: string | null | undefined;
	}
	& (
		| {
			/** セグメント分割を行うか否か */
			split?: false | undefined;
			/** 出力ファイルのパス */
			output: string;
		}
		| {
			/** セグメント分割を行うか否か */
			split: true;
			/** 出力時のコンテナ形式の指定 */
			container: Container.Type;
			/** セグメント分割の間隔を秒数で指定する */
			splitDuration: number;
			/** 出力する初期セグメントのパス */
			outputInit: string;
			/**
			 * 出力するメディアセグメントのパス
			 * * `outputDash` からの相対パスで指定する
			 * * 文字列中に `$Number$` という表記を記載すると、そこが1から始まるセグメント番号に置き換わる
			 */
			outputMedia: string;
			/**
			 * 出力する MPD ファイルのパス
			 * * `outputDash` からの相対パスで指定する
			 * * 省略すると MPD は出力されない
			 */
			outputDash: string;
		}
	)
);

/**
 * FFmpeg の `-vcodec` オプションに指定可能なコーデックの形式を表す型
 *
 * * `undefined` を指定するとオプションを指定しない
 * * `null` を指定するとビデオを含まない扱い (`-vn`) になる
 * * `"copy"` を指定するとコーデックの変換を行わない
 */
type VCodec = VideoCodec.Type | "copy" | null | undefined;
/**
 * FFmpeg の `-acodec` オプションに指定可能なコーデックの形式を表す型
 *
 * * `undefined` を指定するとオプションを指定しない
 * * `null` を指定するとオーディオを含まない扱い (`-an`) になる
 * * `"copy"` を指定するとコーデックの変換を行わない
 */
type ACodec = AudioCodec.Type | "copy" | null | undefined;

/** `ffmpeg` コマンドでビデオのキーフレーム調整を行う場合のオプションの型 */
export interface FFmpegKeyframesOption {
	/** ビデオのフレームレート値 */
	framerate: number;
	/** キーフレームの間隔を秒数で指定 */
	durationInSec: number;
}

/**
 * `VCodec` 型 を `VideoCodec.Type` 型に変換する
 *
 * 変換に失敗した場合は `null` を返す
 */
const castAsVideoCodec = (input: VCodec): VideoCodec.Type | null => (
	(VideoCodec.all as readonly VCodec[]).includes(input) ?
	input as VideoCodec.Type : null
);

/** FFmpeg に渡す入力ファイルのオプションを構成する */
const inputOption = (input: string | string[]) => {
	if (typeof input === "string") return ["-i", input];
	return input.map(path => ["-i", path]).flat();
};

/** FFmpeg に渡すビデオコーデックのオプションを構成する */
const videoCodecOption = (input: VCodec) => {
	if (input === null) return ["-vn"];
	if (input === undefined) return [];
	let codec: string;
	switch (input) {
		case "copy":
			codec = "copy"; break;
		case VideoCodec.H264:
			codec = "libx264"; break;
		case VideoCodec.H265:
			codec = "libx265"; break;
		case VideoCodec.VP9:
			codec = "libvpx-vp9"; break;
		case VideoCodec.VP8:
			codec = "libvpx"; break;
		case VideoCodec.AV1:
			codec = "libsvtav1"; break;
	}
	return ["-c:v", codec];
};

/** FFmpeg に渡すオーディオコーデックのオプションを構成する */
const audioCodecOption = (input: ACodec) => {
	if (input === null) return ["-an"];
	if (input === undefined) return [];
	let codec: string;
	switch (input) {
		case "copy":
			codec = "copy"; break;
		case AudioCodec.AAC:
			codec = "aac"; break;
		case AudioCodec.AC3:
			codec = "ac3"; break;
		case AudioCodec.EAC3:
			codec = "eac3"; break;
		case AudioCodec.DTS:
			codec = "dca"; break;
		case AudioCodec.Opus:
			codec = "opus"; break;
		case AudioCodec.Vorbis:
			codec = "vorbis"; break;
	}
	return ["-c:a", codec];
};

/** FFmpeg に渡す開始位置と終了位置を示すオプションを構成する */
const rangeOption = (start?: number | null, end?: number | null) => [
	...(start != null ? ["-ss",`${start}`] : []),
	...(end != null ? ["-to",`${end}`] : []),
];

/**
 * FFmpeg に渡す映像データ中にラベルを追加するオプションを構成する
 *
 * 引数にラベルの文字列を指定する
 */
const labelingOption = (text: string) => (
	["-vf", [
		`drawtext=text='${text}'`,
		"x=30", "y=30",
		"fontsize=100", "fontcolor=white",
		"box=1", "boxcolor=black@0.5", "boxborderw=5"
	].join(": ")]
);

/**
 * FFmpeg に渡すキーフレーム制御のオプションを構成する
 *
 * * 第1引数にはコーデックを指定する
 * * 第2引数にはビデオのフレームレートを指定する
 * * 第3引数には秒数でキーブレームの間隔を指定する
 *
 * コーデックごとに以下のエンコーダを使用する必要がある
 * * H.264 はエンコーダに `libx264` を使用する
 * * H.265 はエンコーダに `libx265` を使用する
 * * VP8 はエンコーダに `libvpx` を使用する
 * * VP9 はエンコーダに `libvpx-vp9` を使用する
 * * AV1 はエンコーダに `libaom` 或いは `libsvtav1` を使用する
 */
const keyframeOption = (
	codec: VideoCodec.Type,
	framerate: number,
	durationInSec: number
) => {
	// 1セグメントあたりのフレーム数 (= GOP サイズ)
	const gopSize = durationInSec * framerate;

	switch (codec) {
		case VideoCodec.H264:
			return [
				// フレームレートの指定
				"-r", `${framerate}`,
				// libx264 に渡すオプションを用意する
				"-x264-params", [
					// キーフレームを丁度 gopSize フレームに1回入れる
					`keyint=${gopSize}`,     // キーフレーム数の最大値の指定
					`min-keyint=${gopSize}`, // キーフレーム数の最小値の指定
					// シーンカット判定機能を無効化する
					// シーンカット判定とは、エンコーダがキーフレームを入れるべきか判定することをいう。
					// 通常 min-keyint < keyint であればエンコーダは必要と判断すれば適宜キーフレームを挿入する。そのために判定処理が行われている。
					// ここでは min-keyint = keyint なので判断の有無によらずキーフレームの場所は固定されるが、このオプションによりそもそも不必要な判断処理をしないようになる。
					"no-scenecut=1",
				].join(":"),
				// YUV420 のピクセルフォーマットを指定する
				"-pix_fmt", "yuv420p",
			];
			// 以下のオプション指定でも動作するはず
			return [
				// フレームレートの指定
				"-r", `${framerate}`,
				// GOP (group of pictures) サイズの指定
				// キーフレームとその間のフレームの数を指定している
				"-g", `${gopSize}`,
				"-keyint_min", `${gopSize}`, // キーフレーム位置の最小値
				// シーンカット判定機能を無効化する
				"-sc_threshold", "0",
				// YUV420 のピクセルフォーマットを指定する
				"-pix_fmt", "yuv420p",
			];
		case VideoCodec.H265:
			return [
				// フレームレートの指定
				"-r", `${framerate}`,
				// libx265 に渡すオプションを用意する
				"-x265-params", [
					// キーフレームを丁度 gopSize フレームに1回入れる
					`keyint=${gopSize}`,     // キーフレーム数の最大値の指定
					`min-keyint=${gopSize}`, // キーフレーム数の最小値の指定
					// シーンカット判定機能を無効化する
					"scenecut=0",
				].join(":"),
				// YUV420 のピクセルフォーマットを指定する
				"-pix_fmt", "yuv420p",
			];
		case VideoCodec.VP9:
		case VideoCodec.VP8:
			return [
				// フレームレートの指定
				"-r", `${framerate}`,
				// GOP サイズの指定
				"-g", `${gopSize}`,
				// キーフレーム位置の最小値
				"-keyint_min", `${gopSize}`,
				// シーンカット判定機能を無効化する
				"-sc_threshold", "0",
				// YUV420 のピクセルフォーマットを指定する
				"-pix_fmt", "yuv420p",
			];
		case VideoCodec.AV1:
			return [
				// フレームレートの指定
				"-r", `${framerate}`,
				// GOP サイズの指定
				"-g", `${gopSize}`,
				// キーフレーム位置の最小値
				"-keyint_min", `${gopSize}`,
				// シーンカット判定機能を無効化する
				"-sc_threshold", "0",
				// フレームのクオリティを明示する
				// 0 がロスレスで 63 までの間で指定可能
				// 詳細: https://trac.ffmpeg.org/wiki/Encode/AV1#ConstantQuality
				"-crf", "35",
				// YUV420 のピクセルフォーマットを指定する
				"-pix_fmt", "yuv420p",
			];
	}
};

/** FFmpeg に渡すフラグメント化のオプションを構成する */
const fragmentOption = ["-movflags", "+frag_keyframe+empty_moov+default_base_moof"];

/**
 * FFmpeg に渡す暗号化のオプションを構成する
 *
 * key, kid には32桁の16進数文字列を指定する
 */
const encryptionOption = (key: string, kid: string) => [
	// 暗号化スキーム
	"-encryption_scheme", "cenc-aes-ctr",
	// 暗号化キー
	"-encryption_key", key,
	// キーID
	"-encryption_kid", kid,
];

/**
 * FFmpeg に渡す DASH を使ったセグメント分けのオプションを構成する
 *
 * * `container` にはコンテナの形式を指定する
 * * `init` には初期セグメントのパスを指定する
 * * `media` にはメディアセグメントのパスを指定する
 * * `dash` には MPD ファイルのパスを指定する
 */
const dashSegmentOption = (container: Container.Type, init: string, media: string, dash: string, duration: number) => [
	// 出力フォーマットを dash に設定する
	"-f", "dash",
	// dash のセグメント分け形式を指定する
	"-dash_segment_type", segmentType(container),
	// 各セグメントの長さ (秒数)
	"-seg_duration", `${duration}`,
	// 後述の `-media_seg_name` に `$Number$` などのテンプレート表記があった場合に置き換える機能を有効化するかどうか
	"-use_template", "1",
	// セグメントの長さをセグメントごとに個別に指定する機能を有効化するかどうか
	// 有効化すると MPD ファイル内で `SegmentTimeline` により明示的に各セグメントの長さが表記されるようになる
	// 無効化すると `-seg_duration` の値で長さが均一化される
	"-use_timeline", "0",
	// 初期セグメントのパス
	"-init_seg_name", init,
	// メディアセグメントのパス
	"-media_seg_name", media,
	dash,
];

/**
 * FFmpeg の dash muxer の `-dash_segment_type` に指定する値を決定する
 *
 * このオプションの詳細は `ffmpeg -h muxer=dash` を確認可能
 */
const segmentType = (container: Container.Type) => {
	switch (container) {
		case Container.MP4:  return "1";
		case Container.WebM: return "2";
	}
};

/**
 * FFmpeg の実験的機能を有効化するオプションを付加する
 *
 * 渡された `option` オブジェクトから必要な場合には、オプションフラグを返し、必要でない場合は空の配列を返す
 */
const experimentalOption = (option: FfmpegOption) => (
	// Opus, Vorbis エンコーダは実験機能扱いなので、制限を緩めないと利用できない
	option.audioCodec === AudioCodec.Opus ||
	option.audioCodec === AudioCodec.Vorbis
	? ["-strict", "-2"] : []
);