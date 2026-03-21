// このファイルでは `MP4Box` コマンドのラッパー関数 `mp4box` を実装している

import { execSimple } from "~/utils/exec";

/**
 * `MP4Box` 関数のラッパー関数として、動画ファイルを暗号化したり、セグメント分けしたりする
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 */
export const mp4box =
async (option: MP4BoxOption): Promise<void> => {
	// `MP4Box` に渡す引数を構成
	// reference: https://wiki.gpac.io/MP4Box/mp4box-gen-opts/
	// reference: https://wiki.gpac.io/MP4Box/mp4box-dash-opts/
	const args = [
		"MP4Box",
	];

	// CryptFile を指定する
	if (option.cryptFile != null) {
		args.push("-crypt", option.cryptFile);
	}

	// PSSH 情報を付加する
	args.push("-pssh", option.pssh ? "v" : "n");

	// DASH でない場合に入出力のメディアファイルを指定する
	if (option.dash !== true) {
		args.push("-out", option.output, option.input);
	}

	// DASH の場合に DASH の情報を付加する
	else {
		// `-segment-name` オプションの値を構築する
		let segmentName: string;
		if (option.outputInitName) {
			const initName = option.outputInitName;
			const mediaName = option.outputMediaName ?? "seg-$Number$";
			segmentName = `$XInit=${initName}$${mediaName}`;
		} else {
			segmentName = option.outputMediaName ?? "seg-$Number$";
		}

		args.push(
			"-dash", `${option.splitDuration * 1000}`,
			"-frag", `${option.fragmentDuration * 1000}`,
			"-rap",
			"-segment-name", segmentName,
			"-segment-ext", option.outputMediaExt ?? "m4s",
			"-init-segment-ext", option.outputInitExt ?? "mp4",
			...option.input.map(handleInputFile),
			"-out", option.outputDashPath
		);
	}

	// 処理を実行
	await execSimple(args);
};

/** `mp4box` 関数のオプション */
export type MP4BoxOption = (
	& {
		/**
		 * 暗号化する場合に、暗号化構成が記載された XML ファイルを指定する
		 * * 指定がなければ暗号化はしない
		 */
		cryptFile?: string;
		/**
		 * PSSH 情報を付加するか否か
		 * * PSSH はセグメント分割を行う場合には初期セグメントに付加される
		 */
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
			 * * 単純にファイルパスを指定するか、 `{ path: string; kind: "video" | "audio"; representationId: string; }` の形式のオブジェクトを指定する
			 */
			input: (MP4BoxInputFile | string)[];
			/**　出力する MPD ファイルのパス　*/
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
			/** セグメント分割の間隔を秒数で指定する */
			splitDuration: number;
			/** フラグメント化の間隔を秒数で指定する */
			fragmentDuration: number;
		}
	)
);

/** `mp4box` 関数を使ってセグメント分割を行う場合の入力メディアファイルの指定 */
export interface MP4BoxInputFile {
	/** メディアファイルのパス */
	path: string;
	/**
	 * メディアファイルの形式 (ビデオ/オーディオ)
	 *
	 * 通常は明示的に指定する必要はないが、指定することで該当するデータ以外は含まれないようになる
	 * * `"video"`: メディアファイルから最初のビデオストリームのみが選択される
	 * * `"audio"`: メディアファイルから最初のオーディオストリームのみが選択される
	 */
	kind?: null | "audio" | "video";
	/** `Representation` の ID 指定 */
	representationId?: null | string;
}

/** `mp4box` 関数に渡された入力データを引数で使う適切な形式に変換する */
const handleInputFile = (input: string | MP4BoxInputFile): string => {
	// 単にパスが指定されている場合はそのまま
	if (typeof input === "string") return input;

	// オブジェクトが指定されている場合
	const kind =
		input.kind == null ? "" :
		`#${input.kind}`;
	const repId =
		input.representationId == null ? "" :
		`:id=${input.representationId}`;

	return `${input.path}${kind}${repId}`;
};