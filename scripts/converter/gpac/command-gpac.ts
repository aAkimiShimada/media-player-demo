// このファイルでは `gpac` コマンドのラッパー関数 `gpac` を実装している

import { AudioCodec, VideoCodec } from "~/types/convert-description";

import { exec, execSimple, Status } from "~/utils/exec";

/**
 * `gpac` 関数のラッパー関数として、動画ファイルを暗号化したり、セグメント分けしたりする
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 */
export const gpac =
async (option: GpacOption): Promise<void> => {
	// `gpac` に渡す引数を構成
	// reference: https://wiki.gpac.io/Filters/dasher/#options
	const args = [
		"gpac",
	];

	// 入力のメディアファイルを指定する
	if (option.dash !== true) {
		args.push("-i", handleInputFile({
			path: option.input,
			codecInfo: option.codecInfo
		}));
	}
	else {
		args.push(
			...option.input.map(item => (
				["-i", handleInputFile(item)]
			)).flat()
		);
	}

	// XML ファイルが指定されて暗号化設定されている場合に、暗号化指定を行う
	if (option.cryptFile !== undefined) {
		args.push(`cecrypt:cfile=${option.cryptFile}`);
	}

	// DASH でない場合に出力のメディアファイルを指定する
	if (option.dash !== true) {
		args.push("-o", option.output);
	}

	// DASH の場合に DASH の情報を付加する
	else {
		// フィルターオプションについて `:` で結合するデータを構成する
		const filters = [
			`segdur=${option.splitDuration}`
		];

		// `template` オプションの値を構築する
		const initName = option.outputInitName ?? "init";
		const mediaName = option.outputMediaName ?? "seg-$Number$";
		const template = `$XInit=${initName}$${mediaName}`;
		filters.push(`template=${template}`);

		// `initName` の末尾に `$` が含まれる値になっている場合にはエラー扱いにする
		// `$$` が2連続になるとエスケープされて `$` という文字として扱われるから
		if (initName.endsWith("$")) {
			throw new Error("outputInitName が $ で終わる文字列はサポートしていません");
		}

		const initExt = option.outputInitExt ?? "mp4";
		filters.push(`initext=${initExt}`);

		const mediaExt = option.outputMediaExt ?? "m4s";
		filters.push(`segext=${mediaExt}`);

		// `gencues` を使う場合と使わない場合でフィルター指定方法が異なるので場合分け
		if (option.gencues) {
			// `gencues` を使う場合は必ずすべての入力ファイルで暗号化キーが設定されていることを前提とする
			const cryptFiles = option.input.map(item => {
				if (typeof item === "string") return null;
				return item.cryptFile;
			});
			if (cryptFiles.some(file => file == null)) {
				throw new Error("guecues を使う場合は全ての入力に暗号化キーが設定されている必要があります");
			}

			// 後で使うので XML ファイルを1つだけ選ぶ
			const cryptFile = cryptFiles[ Math.floor(Math.random()*cryptFiles.length) ];

			// `gencues` を使う場合は `-o` とは別に指定する
			filters.unshift("dasher", "gencues");
			args.push(
				filters.join(":"),
				// 暗号化を司る cecrypt フィルターは必ず cfile で XML ファイルを指定しなければならない
				// ただしこちらは各々の入力における `#CryptFile` で指定された XML ファイルの方が優先的に使用されるので、実際には使われない指定である
				`cecrypt:cfile=${cryptFile}`,
				"-o", option.outputDashPath
			);
		}
		else {
			// 使わない場合は `-o` に対するフィルターとして設定する
			filters.unshift(option.outputDashPath);
			args.push("-o", filters.join(":"));
		}
	}

	// 処理を実行
	await execSimple(args);
};

/** `gpac` 関数のオプション */
export type GpacOption = (
	& (
		| {
			/**
			 * 暗号化する場合に、暗号化構成が記載された XML ファイルを指定する
			 *
			 * 複数のストリームが渡されている場合には全てのストリームに同じ暗号化設定が適用される
			 */
			cryptFile: string;
			/**
			 * `dasher:gencues` オプションを指定する
			 *
			 * 入力ファイルごとに個別に暗号化設定を行う場合にはこのオプションを指定する
			 */
			gencues?: false;
		}
		| {
			/**
			 * 暗号化する場合に、暗号化構成が記載された XML ファイルを指定する
			 *
			 * 複数のストリームが渡されている場合には全てのストリームに同じ暗号化設定が適用される
			 */
			cryptFile?: undefined;
			/**
			 * `dasher:gencues` オプションを指定する
			 *
			 * 入力ファイルごとに個別に暗号化設定を行う場合にはこのオプションを指定する
			 */
			gencues?: boolean;
		}
	)
	& {
		/** PSSH 情報を付加するか否か */
		pssh?: boolean;
	}
	& (
		| {
			/**
			 * DASH 出力モードの有効化/無効化を切り替える
			 * * `false` ... 単一のメディアファイルの入出力を行う
			 * * `true` ... メディアのセグメント分けを行い、必要に応じて MPD ファイルを出力する
			 */
			dash?: false | undefined;
			/** 入力メディアファイルのパス */
			input: string;
			/** 出力メディアファイルのパス */
			output: string;
			/**
			 * メディアのコーデック情報
			 *
			 * 一部のコーデックでは `gpac` にコーデック情報を明示的に渡す必要がある。ここで指定すべき値は `getCodecInfo` 関数から取得できる。
			 */
			codecInfo?: string | null;
		}
		| {
			/**
			 * DASH 出力モードの有効化/無効化を切り替える
			 * * `false` ... 単一のメディアファイルの入出力を行う
			 * * `true` ... メディアのセグメント分けを行い、必要に応じて MPD ファイルを出力する
			 */
			dash: true;
			/**
			 * 入力メディアファイルの配列
			 * * 単純にファイルパスを指定するか、 `{ path: string; cryptFile: string; representationId: string; indexStartNumber: number; outputName: string; }` の形式のオブジェクトを指定する
			 */
			input: (GpacInputFile | string)[];
			/** セグメント分割の間隔を秒数で指定する */
			splitDuration: number;
			/** 出力する MPD ファイルのパス */
			outputDashPath: string;
			/**
			 * 出力する初期セグメントの拡張子を除くファイル名
			 *
			 * `outputDashPath` で示した MPD ファイルからの相対パスで指定される
			 *
			 * 以下の文字列は自動的に置き換えられる
			 * * `$RepresentationID$`: 元となった入力メディアの番号
			 *
			 * 指定がなければ `init` が使用される
			 */
			outputInitName?: string;
			/**
			 * 出力するメディアセグメントの拡張子を除くファイル名
			 *
			 * `outputDashPath` で示した MPD ファイルからの相対パスで指定される
			 *
			 * 以下の文字列は自動的に置き換えられる
			 * * `$Number$`: 1から始まるセグメントの番号
			 * * `$RepresentationID$`: 元となった入力メディアの番号
			 *
			 * 指定がなければ `seg-$Number$` が使用される
			 */
			outputMediaName?: string;
			/**
			 * 出力する初期セグメントの拡張子
			 * * 省略すると `mp4` になる
			 */
			outputInitExt?: string;
			/**
			 * 出力するメディアセグメントの拡張子
			 * * 省略すると `m4s` になる
			 */
			outputMediaExt?: string;
		}
	)
);

/** `gpac` 関数を使ってセグメント分割を行う場合の入力メディアファイルの指定 */
export interface GpacInputFile {
	/** メディアファイルのパス */
	path: string;
	/**
	 * メディアのコーデック情報
	 *
	 * 一部のコーデックでは `gpac` にコーデック情報を明示的に渡す必要がある。ここで指定すべき値は `getCodecInfo` 関数から取得できる。
	 */
	codecInfo?: string | null;
	/** 暗号化する場合に、暗号化構成が記載された XML ファイルを指定する */
	cryptFile?: null | string;
	/** `Representation` の ID 指定 */
	representationId?: null | string;
	/**
	 * メディアセグメントの開始番号
	 * * 指定しない場合は 1 に設定される
	 */
	indexStartNumber?: null | number;
	/**
	 * 出力する初期セグメントの拡張子を除くファイル名
	 *
	 * `outputDashPath` で示した MPD ファイルからの相対パスで指定される
	 *
	 * 以下の文字列は自動的に置き換えられる
	 * * `$RepresentationID$`: 元となった入力メディアの番号
	 *
	 * 指定がなければ `init` が使用される
	 */
	outputInitName?: string;
	/**
	 * 出力するメディアセグメントの拡張子を除くファイル名
	 *
	 * `outputDashPath` で示した MPD ファイルからの相対パスで指定される
	 *
	 * 以下の文字列は自動的に置き換えられる
	 * * `$Number$`: セグメントの番号
	 * * `$RepresentationID$`: 元となった入力メディアの番号
	 *
	 * 指定がなければ `seg-$Number$` が使用される
	 */
	outputMediaName?: string;
}

/** 入力ファイルのコーデック形式を表す型 */
type Codec = VideoCodec.Type | AudioCodec.Type | null;

/** `gpac` 関数に渡された入力データを引数で使う適切な形式に変換する */
const handleInputFile = (input: string | GpacInputFile): string => {
	// reference: https://wiki.gpac.io/Filters/dasher/#pid-assignment-and-configuration

	// 単にパスが指定されている場合はそのまま
	if (typeof input === "string") return input;

	// オブジェクトが指定されている場合、フィルターを構成していく
	const filters = [ input.path ];

	if (input.codecInfo != null) {
		filters.push(`#Codec=${input.codecInfo}`);
	}

	if (input.cryptFile != null) {
		filters.push(`#CryptFile=${input.cryptFile}`);
	}

	if (input.representationId != null) {
		filters.push(`#Representation=${input.representationId}`);
	}

	if (input.indexStartNumber != null) {
		filters.push(`#StartNumber=${input.indexStartNumber}`);
	}

	if (
		input.outputInitName  != null ||
		input.outputMediaName != null
	) {
		const initName = input.outputInitName ?? "init";
		const mediaName = input.outputMediaName ?? "seg-$Number$";

		const template = `$XInit=${initName}$${mediaName}`;
		filters.push(`#Template=${template}`);

		// `initName` の末尾に `$` が含まれる値になっている場合にはエラー扱いにする
		// `$$` が2連続になるとエスケープされて `$` という文字として扱われるから
		if (initName.endsWith("$")) {
			throw new Error("outputInitName が $ で終わる文字列はサポートしていません");
		}
	}

	return filters.join(":");
};

/**
 * VP8, VP9 コーデックを使用する場合に、 `gpac` に渡す必要のあるコーデック情報を取得する
 *
 * GPAC は WebM コンテナから VP8/VP9 を読み込む際に VPCodecConfigurationRecord を取得できないため、
 * プロファイル・レベル・ビット深度の情報が欠落する。
 * そのため `ffprobe` を用いて RFC 6381 準拠のコーデック文字列を取得し、 `#Codec` PID プロパティとして指定する必要がある。
 */
export const getCodecInfo = async (path: string, codec: Codec): Promise<string | null> => {
	// VP8, VP9 以外の場合を除外
	switch (codec) {
		case VideoCodec.VP8:
		case VideoCodec.VP9:
			break;
		default:
			return null;
	}

	// `ffprobe` を使って RFC 6381 準拠のコーデック文字列を取得する
	const result = await exec([
		"ffprobe",
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=mime_codec_string",
		"-of", "csv=p=0",
		path,
	], {}, "pipe").promise;

	// 取得に失敗した場合も `null` を返す
	if (result.status !== Status.Success || result.output == null) {
		return null;
	}

	return result.output.trim();
};