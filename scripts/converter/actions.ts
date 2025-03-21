// このファイルでは、1つ1つの作業ステップ (=コマンド呼び出し) に対応する関数を定義している

import { exec, Status } from "./utils";
import { Resolution, segmentCount, segmentDuration } from "./consts";
import { mkdir } from "node:fs/promises";
import { stat as getStat } from "node:fs/promises";
import * as path from "node:path";

/** `convertToFragment` 関数のオプション */
export interface ConvertToFragmentInfo {
	/** 元の動画ファイるのパス */
	input: string;
	/** 出力されるフラグメント化した動画ファイルを保存するパス */
	output: string;
	/**
	 * 使用するトラックを設定する
	 * * `"video"`: 映像のみ
	 * * `"audio"`: 音声のみ
	 */
	track?: "video" | "audio" | undefined;
}

/** 動画ファイルをフラグメントに分割する */
export const convertToFragment =
async (info: ConvertToFragmentInfo): Promise<void> => {
	// ミリ秒でセグメント毎の間隔を設定する
	const duration = segmentDuration * 1000;

	// 使用するトラックの指定
	const trackOption =
		info.track !== undefined ?
		[ "--track", info.track ] : [];

	// 処理を実行
	// reference: https://www.bento4.com/documentation/mp4fragment/
	const result = await exec([
		"mp4fragment",
		"--fragment-duration",`${duration}`,
		...trackOption,
		info.input, info.output
	]).promise;

	// 正常終了でなければエラー放出
	if (result !== Status.Success) throw new Error("failure");
};

/** `splitFragment` 関数のオプション */
export interface SplitFragmentInfo {
	/** 分割前のフラグメント動画ファイルのパス */
	input: string;
	/** 分割したファイルを保存するディレクトリのパス */
	output_dir: string;
	/**
	 * 初期データの名前の形式
	 * * 指定しなければ規定値 `init.mp4` を使用する
	 */
	initialSegment?: string | undefined;
	/**
	 * メディアデータの名前の形式
	 * * テンプレート `%llu` によりセグメント番号をファイル名の中に入れられる
	 * * 指定しなければ初期値 `seg-%llu.m4s` を使用する
	 */
	mediaSegment?: string | undefined;
}

/**
 * フラグメント化したファイルを別々のファイルに分割する
 *
 * `mp4split` コマンドのラッパーである
 */
export const splitFragment =
async (info: SplitFragmentInfo): Promise<void> => {
	// 出力先ファイルパス/パスパターンを設定
	const initSegment = path.join(
		info.output_dir,
		info.initialSegment ?? "init.mp4"
	);
	const mediaSegment = path.join(
		info.output_dir,
		info.mediaSegment ?? "seg-%llu.m4s"
	); // `%llu` の部分にインデクスが入る

	// 処理を実行
	// reference: https://www.bento4.com/documentation/mp4split/
	const result = await exec([
		"mp4split",
		"--init-segment", initSegment,
		"--media-segment", mediaSegment,
		// セグメントの付番は0から始める
		"--start-number", "0",
		// `--media-segment` における変数 %llu の意味
		"--pattern-parameters", "N",
			// I: トラック番号
			// N: セグメント番号
			// デフォルトでは IN に設定されており、2つの %llu を与えることで1つ目が I で2つ目が N に置換されるようになっている
		info.input
	]).promise;

	// 正常終了でなければエラー放出
	if (result !== Status.Success) throw new Error("failure");
};

/** `encrypt` 関数のオプション */
export interface EncryptInfo {
	/** 暗号化されていない元の動画ファイルのパス */
	input: string;
	/** 出力する暗号化された動画ファイルのパス */
	output: string;
	/** 暗号化のキー */
	keys: (
		{
			/** 対象とする、コンテナ内のトラック番号 */
			trackNo: number;
		} & EncryptionKey
	)[];
}

/**
 * 動画ファイルの暗号化を実行する
 *
 * `mp4encrypt` コマンドのラッパーである
 */
export const encrypt =
async (info: EncryptInfo): Promise<void> => {
	// キー情報をオプションの形式に変換
	const keys = info.keys.map(({ trackNo, keyId, key, iv }) => ([
		"--key", `${trackNo}:${key}:${iv ?? "random"}`,
		"--property", `${trackNo}:KID:${keyId}`
	])).flat();

	// 処理を実行
	// reference: https://www.bento4.com/documentation/mp4encrypt/
	const result = await exec([
		"mp4encrypt",
		"--method", "MPEG-CENC",
		...keys,
		"--global-option", "mpeg-cenc.eme-pssh:true",
		info.input, info.output
	]).promise;

	// 正常終了でなければエラー放出
	if (result !== Status.Success) throw new Error("failure");
};

/** `createDashSegments` 関数のオプション */
export interface CreateDashSegmentsInfo {
	/** フラグメント化済み動画ファイルパスのリスト */
	input: string[];
	/** 生成したセグメントを保存するディレクトリのパス */
	output_dir: string;
	/**
	 * 暗号化のキー
	 *
	 * 指定がなければ暗号化は行われない (既に暗号化している場合は除く)
	 */
	keys?: EncryptionKey[] | undefined;
	/**
	 * MPD ファイルの名称
	 *
	 * 指定しなければ初期値 `stream.mpd` を使用する
	 */
	mpdName?: string | undefined;
}

/**
 * フラグメント化済みのファイルを MPEG-DASH の形式でファイルに分割する。合わせて必要であれば暗号化も行う。
 *
 * MPEG-DASH に合わせた形式になるため `.mpd` ファイルが生成され、ディレクトリ構成も固定される。
 *
 * この処理を行う代わりに `splitFragment` で分離することもできる。かつては `splitFragment` で分割した動画は正常に再生できないことがあったらしい。おそらく現在は `splitFragment` で分割した動画でも再生できる。
 *
 * `mp4dash` コマンドのラッパーである
 */
export const createDashSegments =
async (info: CreateDashSegmentsInfo): Promise<void> => {
	// キー情報をオプションの形式に変換
	const encryptionKeys = (info.keys ?? []).map(({ keyId, key, iv }) => ([
		"--encryption-key",
		iv != undefined ?
		`${keyId}:${key}:${iv}` : `${keyId}:${key}`
	])).flat();

	// 処理を実行
	// reference: https://www.bento4.com/documentation/mp4dash/
	const result = await exec([
		"mp4dash", "-f",
		"-o", info.output_dir,
		`--mpd-name=${info.mpdName ?? "stream.mpd"}`,
		...encryptionKeys,
		...info.input
	]).promise;

	// 正常終了でなければエラー放出
	if (result !== Status.Success) throw new Error("failure");
};

/** `encrypt` や `createDashSegments` で使用する暗号化キーの設定データ */
interface EncryptionKey {
	/**
	 * キー ID
	 * * 16進数表記
	 */
	keyId: string;
	/**
	 * キー
	 * 16進数表記
	 */
	key: string;
	/**
	 * 固有ベクトル
	 * * 任意指定で、指定がなかったらランダムに決定
	 * * 16進数表記
	 * * 16文字或いは32文字で指定
	 */
	iv?: string | undefined;
};

/** `arrangeWithFFmpeg` 関数のオプション */
export interface ArrangeWithFFmpegInfo {
	/** 変換前の動画ファイルのパス */
	input: string;
	/** 出力する変換後の動画ファイルのパス */
	output: string;
	/**
	 * 出力に入れるデータ
	 * * `"video"`: 映像のみ
	 * * `"audio"`: 音声のみ
	 * * `"both"`: 映像と音声の両方
	 */
	mode?: "video" | "audio" | "both" | undefined;
	/** 映像出力のオプション (省略可能) */
	videoOptions?: {
		/** 解像度の設定 (省略可能) */
		resolution?: Resolution | undefined;
		/**
		 * 動画中に埋め込む説明テキスト (省略可能)
		 *
		 * 注意: このフィールドの値は特に加工せずそのままコマンドに渡されるので、不適切な値を渡すと容易にインジェクション可能です。意図しない挙動が見られたら自己責任でお願いします。
		 */
		description?: string | undefined;
	} | undefined;
}

/**
 * `ffmpeg` を使って動画に幾つかの操作を行う
 *
 * 具体的には
 * * 動画全体から一部分だけ取り出す
 * * 映像に説明ラベルを追加する
 * * 映像の解像度を調整する
 * * 映像のキーフレーム位置を調整する
 * * 必要であれば映像のみ取り出す/音声のみ取り出す
 */
export const arrangeWithFFmpeg =
async (info: ArrangeWithFFmpegInfo): Promise<void> => {
	// 映像関連のオプション
	const videoOptions = info.videoOptions ?? {};

	// 有効/無効のフラグ
	const enableAudio = info.mode !== "video";
	const enableVideo = info.mode !== "audio";
	const editingVideo =
		// 映像の改変がない場合に限ってデコード/エンコードをスキップできる
		enableVideo && (
			videoOptions.resolution !== undefined ||
			videoOptions.description !== undefined
		);

	// 映像/音声の出力を無効化するオプションを用意
	const streamOption = [
		...(!enableAudio ? ["-an"] : ["-acodec", "copy"]),
		...(
			!enableVideo ? ["-vn"] :
			!editingVideo ? ["-vcodec", "copy"] :
			[]
		),
	];

	// 動画から一部範囲を取り出すオプションを用意
	const rangeOption = [
		"-ss", "0", "-to", `${segmentDuration * segmentCount}`
	];

	// 解像度選択のオプションを用意
	const resolutionOption =
		// 映像出力が有効で、解像度指定がある場合のみ
		enableVideo && videoOptions.resolution !== undefined ?
		["-s", videoOptions.resolution] : [];

	// 説明ラベル追加のオプションを用意
	const labelingOption =
		// 映像出力が有効で、説明テキストの指定がある場合のみ
		enableVideo && videoOptions.description !== undefined ?
		["-vf", [
			`drawtext=text='${videoOptions.description}'`,
			"x=30", "y=30",
			"fontsize=100", "fontcolor=white",
			"box=1", "boxcolor=black@0.5", "boxborderw=5"
		].join(": ")] : [];

	// 映像のフレーム関連のオプションを用意
	const frameOptions = !enableVideo ? [] : [
		// キーフレームを最低30フレームに1つは入れる
		"-keyint_min", "30",
		// GOP (group of pictures) サイズの指定
		// キーフレームとその間のフレームの数を指定している
		"-g", "30",
		// シーンチェンジ検出を無効にする
		// シーンが切り替わる毎にキーフレームを挿入する機能は使わない
		"-sc_threshold", "0",
		// フレームレートは 30 fps である
		"-r", "30"
	];

	const result = await exec([
		"ffmpeg",
		"-y", // 既にファイルが存在していれば上書き
		"-i", info.input,
		...rangeOption,      // -ss, -to
		...streamOption,     // -vn, -an
		...labelingOption,   // -vf "..."
		...frameOptions,     // -keyint_min, -g, -sc_threshold, -r
		...resolutionOption, // -s
		info.output
	]).promise;

	// 正常終了でなければエラー放出
	if (result !== Status.Success) throw new Error("failure");
};

/** ディレクトリを作成する */
export const makeDirs =
async (path: string): Promise<void> => {
	await mkdir(path, { recursive: true });
};

/** ファイルの存在を確認する */
export const isFileExist =
async (path: string): Promise<boolean> => {
	try {
		const stat = await getStat(path);
		return stat.isFile();
	}
	// ファイルやディレクトリなどが一切存在していない場合
	catch(_) {
		return false;
	}
};