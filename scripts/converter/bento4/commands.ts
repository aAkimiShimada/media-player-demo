// このファイルでは Bento4 の各種コマンドに対するラッパー関数を実装している

import { execSimple } from "~/utils/exec";

/**
 * `mp4fragment` のラッパー関数として、動画ファイルをフラグメントに分割する
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 */
export const convertToFragment =
async (option: ConvertToFragmentOption): Promise<void> => {
	// `mp4fragment` に渡す引数を構成
	// reference: https://www.bento4.com/documentation/mp4fragment/
	const args = [
		"mp4fragment"
	];

	// ミリ秒でセグメント毎の間隔を設定する
	const duration = option.duration * 1000;
	args.push("--fragment-duration", `${duration}`);

	// 使用するトラックの指定
	if (option.track !== undefined) {
		args.push("--track", option.track);
	}

	// 入出力の指定
	args.push(option.input, option.output);

	// 処理を実行
	await execSimple(args);
};

/** `convertToFragment` 関数のオプション */
export interface ConvertToFragmentOption {
	/** 元の動画ファイるのパス */
	input: string;
	/** 出力されるフラグメント化した動画ファイルを保存するパス */
	output: string;
	/** セグメント毎の間隔を秒数で設定する */
	duration: number;
	/**
	 * 使用するトラックを設定する
	 * * `"video"`: 映像のみ
	 * * `"audio"`: 音声のみ
	 */
	track?: "video" | "audio" | undefined;
}

/**
 * `mp4split` コマンドのラッパーとして、フラグメント化したファイルを別々のファイルに分割する
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 */
export const splitFragment =
async (option: SplitFragmentOption): Promise<void> => {
	// `mp4split` に渡す引数を構成
	// reference: https://www.bento4.com/documentation/mp4split/
	const args = [
		"mp4split",
		"--init-segment", option.outputInit,
		"--media-segment", option.outputMedia,
		// セグメントの付番
		"--start-number", `${option.indexStartNumber ?? 0}`,
		// `--media-segment` における変数 %llu の意味
		"--pattern-parameters", "N",
			// I: トラック番号
			// N: セグメント番号
			// デフォルトでは IN に設定されており、2つの %llu を与えることで1つ目が I で2つ目が N に置換されるようになっている
		option.input
	];

	// 処理を実行
	await execSimple(args);
};

/** `splitFragment` 関数のオプション */
export interface SplitFragmentOption {
	/** 分割前のフラグメント動画ファイルのパス */
	input: string;
	/** 出力する初期セグメントのパス */
	outputInit: string;
	/**
	 * 出力するメディアセグメントのパス
	 * * 文字列中に `%llu` という表記を記載すると、そこがセグメント番号に置き換わる
	 */
	outputMedia: string;
	/**
	 * メディアセグメントの開始番号
	 * * 指定しない場合は 0 に設定される
	 */
	indexStartNumber?: number;
}

/**
 * `mp4encrypt` コマンドのラッパーとして、動画ファイルの暗号化を実行する
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 */
export const encrypt =
async (option: EncryptOption): Promise<void> => {
	// `mp4encrypt` に渡す引数を構成
	// reference: https://www.bento4.com/documentation/mp4encrypt/
	const args = [
		"mp4encrypt",
		"--method", "MPEG-CENC",
	];

	// キー情報をオプションの形式に変換
	args.push(
		...option.keys.map(
			({ trackNo, keyId, key, iv }) => ([
				"--key", `${trackNo}:${key}:${iv ?? "random"}`,
				"--property", `${trackNo}:KID:${keyId}`
			])
		).flat()
	);

	// PSSH 情報を付加する
	if (option.pssh) {
		args.push("--global-option", "mpeg-cenc.eme-pssh:true");
	}
	// PIFF 情報を付加する
	if (option.piff) {
		args.push("--global-option", "mpeg-cenc.piff-compatible:true");
	}

	// 入出力ファイルを指定する
	args.push(option.input, option.output);

	// 処理を実行
	await execSimple(args);
};

/** `encrypt` 関数のオプション */
export interface EncryptOption {
	/** 暗号化されていない元の動画ファイルのパス */
	input: string;
	/** 出力する暗号化された動画ファイルのパス */
	output: string;
	/** 暗号化のキー */
	keys: EncryptOptionEncryptionKey[];
	/** PSSH 情報を付加するか否か */
	pssh?: boolean;
	/** PIFF 情報を付加するか否か */
	piff?: boolean;
}

/** `encrypt` で使用する暗号化キーの設定データ */
type EncryptOptionEncryptionKey = {
	/** 対象とする、コンテナ内のトラック番号 */
	trackNo: number;
} & EncryptionKey;

/**
 * `mp4dash` コマンドのラッパーとしてフラグメント化済みのファイルを MPEG-DASH の形式でファイルに分割する。合わせて必要であれば暗号化も行う。
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 *
 * MPEG-DASH に合わせた形式になるため `.mpd` ファイルが生成され、ディレクトリ構成も固定される。
 *
 * この処理を行う代わりに `splitFragment` で分離することもできる。かつては `splitFragment` で分割した動画は正常に再生できないことがあったらしい。おそらく現在は `splitFragment` で分割した動画でも再生できる。
 */
export const createDashSegments =
async (option: CreateDashSegmentsOption): Promise<void> => {
	// `mp4dash` に渡す引数を構成
	// reference: https://www.bento4.com/documentation/mp4dash/
	const args = [
		"mp4dash",
		// 既にディレクトリが存在していても上書きする
		"--force",
		`--output-dir=${option.outputDir}`,
		`--mpd-name=${option.mpdName}`,
	];

	// キー情報をオプションの形式に変換
	args.push(
		...(option.keys ?? []).map(
			({ index, keyId, key, iv }) => {
				const info = [`index=${index}`, keyId, key];
				if (iv != undefined) info.push(iv);
				return ["--encryption-key", info.join(":")];
			}
		).flat()
	);

	// 暗号化オプションの設定
	{
		const options: string[] = [];
		// PSSH 情報を付加する
		if (option.pssh) {
			options.push("--global-option", "mpeg-cenc.eme-pssh:true");
		}
		// PIFF 情報を付加する
		if (option.piff) {
			options.push("--global-option", "mpeg-cenc.piff-compatible:true");
		}
		// 指定があった場合にのみ追加する
		if (options.length > 0) {
			args.push(`--encryption-args=${options.join(" ")}`);
		}
	}

	// 入力となるフラグメントファイルを指定する
	args.push(
		...option.input.map(item => {
			if (typeof item === "string") return item;

			type Pair = [key: string, value: string | undefined];
			const pairs: Pair[] = [
				["type", item.type],
				["+representation_id", item.representationId]
			];
			const joined = pairs
				.filter(([,value]) => value != null)
				.map(([key,value]) => `${key}=${value}`)
				.join(",");
			return `[${joined}]${item.path}`;
		})
	);

	// 処理を実行
	await execSimple(args);
};

/** `createDashSegments` 関数のオプション */
export interface CreateDashSegmentsOption {
	/**
	 * フラグメント化済み動画ファイルパスのリスト
	 *
	 * 単純にファイルパスを指定するか、 `{ path: string; kind: "video" | "audio"; representationId: string; }` の形式のオブジェクトを指定する
	 */
	input: (string | CreateDashInputFile)[];
	/** 生成したセグメントを保存するディレクトリのパス */
	outputDir: string;
	/**
	 * 暗号化のキー
	 *
	 * 指定がなければ暗号化は行われない (既に暗号化している場合は除く)
	 */
	keys?: DashSegmentsOptionEncryptionKey[] | undefined;
	/** 暗号化する場合に PSSH 情報を付加するか否か */
	pssh?: boolean;
	/** 暗号化する場合に PIFF 情報を付加するか否か */
	piff?: boolean;
	/**
	 * MPD ファイルの名称
	 */
	mpdName: string;
}

/** `createDashSegments` の入力ファイル指定で、より詳細なオプションを指定可能な形式 */
export interface CreateDashInputFile {
	/** ファイルパス */
	path: string;
	/**
	 * メディアファイルの形式 (ビデオ/オーディオ)
	 *
	 * 通常は明示的に指定する必要はないが、指定することで該当するデータ以外は含まれないようになる
	 * * `"video"`: メディアファイルから最初のビデオストリームのみが選択される
	 * * `"audio"`: メディアファイルから最初のオーディオストリームのみが選択される
	 */
	type?: null | "video" | "audio";
	/** `Representation` の ID 指定 */
	representationId?: null | string;
}

/** `createDashSegments` で使用する暗号化キーの設定データ */
type DashSegmentsOptionEncryptionKey = {
	/**
	 * 対象とする、入力ファイルの番号
	 * * 最初のアイテムは1である
	 */
	index: number;
} & EncryptionKey;

/** `encrypt` や `createDashSegments` で使用する暗号化キーの設定データ */
interface EncryptionKey {
	/**
	 * キー ID
	 * * 16進数表記
	 */
	keyId: string;
	/**
	 * キー
	 * * 16進数表記
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