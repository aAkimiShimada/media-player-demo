// このファイルでは `packager` コマンドのラッパー関数 `packager` を実装している

import { execSimple } from "~/utils/exec";

/**
 * Shaka Packager の `packager` コマンドのラッパー関数として、動画ファイルを暗号化したり、セグメント分けしたりする
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 */
export const packager =
async (option: PackagerOption): Promise<void> => {
	// `packager` に渡す引数を構成
	const args = [
		"packager"
	];

	// 暗号化を行う場合にオプションを指定
	if (option.encryptionKeys !== undefined && option.encryptionKeys.length > 0) {
		args.push(
			"--protection_scheme=cenc",
			"--enable_raw_key_encryption",
			"--keys",
			option.encryptionKeys.map(encKey => (
				`label=${encKey.label}:key_id=${encKey.keyId}:key=${encKey.key}`
			)).join(",")
		);

		// PSSH 情報を設定
		args.push(`--mp4_include_pssh_in_stream=${option.pssh ? "true" : "false"}`);
	}

	// セグメント分割を行う場合特有のオプションを指定する
	if (option.split) {
		// セグメント開始番号を設定
		if (option.indexStartNumber != null) {
			args.push("--start_segment_number", `${option.indexStartNumber}`);
		}
		args.push(
			// フラグメント分けの間隔を指定
			"--fragment_duration", `${option.fragmentDuration}`,
			// セグメント分割の間隔を指定
			"--segment_duration", `${option.splitDuration}`,
		);
	}

	// MPD 出力する場合に出力先を指定
	if (option.outputMpd !== undefined) {
		args.push("--mpd_output", option.outputMpd);
	}

	// ディスクリプタを引数として渡せる形で構成する
	args.push(
		...option.streamDescriptors.map(
			d => descriptorToString(d, option.split ?? false)
		)
	);

	// 処理を実行
	await execSimple(args);
};

/** `packager` 関数のオプション */
export type PackagerOption = (
	& {
		/**
		 * 暗号化を行う場合に暗号化キーを設定する
		 * * 未指定や空配列の場合には暗号化は行われない
		 */
		encryptionKeys?: PackagerEncryptionKey[];
		/**
		 * MPD ファイルを出力する場合に、そのパスを指定する
		 * * 指定がなければ MPD は出力されない
		 */
		outputMpd?: string;
		/**
		 * PSSH 情報を付加するか否か
		 * * 暗号化を一切行わない場合にはこの指定は機能しない
		 */
		pssh?: boolean;
	}
	& (
		| {
			/** セグメント分割を行うか否か */
			split?: false;
			/** 入出力のファイルを構成するストリームディスクリプタを用意する */
			streamDescriptors: PackagerStreamDescriptor<false>[];
		}
		| {
			/** セグメント分割を行うか否か */
			split: true;
			/** セグメント分割の間隔を秒数で指定する */
			splitDuration: number;
			/** フラグメント化の間隔を秒数で指定する */
			fragmentDuration: number;
			/** 入出力のファイルを構成するストリームディスクリプタを用意する */
			streamDescriptors: PackagerStreamDescriptor<true>[];
			/**
			 * メディアセグメントの開始番号
			 * * 指定しない場合は 1 に設定される
			 */
			indexStartNumber?: null | number;
		}
	)
);

/**
 * `packager` に渡す1つのストリームディスクリプタを表す型
 * * 型パラメータ `Split` にはセグメント分割するか否かをブール値で示す
 */
export type PackagerStreamDescriptor<Split extends boolean = boolean> = (
	boolean extends Split ? (DescriptorForSingleFile | DescriptorForSplitting) :
	Split extends false ? DescriptorForSingleFile :
	Split extends true  ? DescriptorForSplitting  :
	never
);

/** `PackageStreamDescriptor` のうち、単一ファイルの出力を行う場合のオプション */
interface DescriptorForSingleFile {
	/** 入力メディアファイルのパス */
	input: string;
	/** ストリームの種類 */
	stream: "video" | "audio";
	/**
	 * 暗号化オプションの暗号化キーと対応付けるためのラベル
	 * * `PackageEncryptionKey.label` の値を一致させる必要がある
	 * */
	drmLabel?: string;
	/** 出力メディアファイルのパス */
	output: string;
}

/** `PackageStreamDescriptor` のうち、セグメント分割を行う場合のオプション */
interface DescriptorForSplitting {
	/** 入力メディアファイルのパス */
	input: string;
	/** ストリームの種類 */
	stream: "video" | "audio";
	/**
	 * 暗号化オプションの暗号化キーと対応付けるためのラベル
	 * * `PackageEncryptionKey.label` の値を一致させる必要がある
	 * */
	drmLabel?: string;
	/** 出力の初期セグメントのパス */
	outputInit: string;
	/**
	 * 出力のメディアセグメントのパス
	 *
	 * 以下の文字列は自動的に置き換えられる
	 * * `$Number$`: 0から始まるセグメントの番号
	 * * `$RepresentationID$`: 元となった入力メディアの番号
	 */
	outputMedia: string;
}

/** `packager` の暗号化オプションに渡す1つの暗号化データを表す型 */
export interface PackagerEncryptionKey {
	/**
	 * ストリームディスクリプタと対応付けるラベル
	 * * `PackagerStreamDescriptor.drmLabel` と値を一致させる必要がある
	 */
	label: string;
	/** キーID */
	keyId: string;
	/** 暗号化キー */
	key: string;
}

/** `PackageStreamDescriptor` 型のディスクリプタを引数に使う文字列形式に変換する */
const descriptorToString = <Split extends boolean>(
	descriptor: PackagerStreamDescriptor<Split>, split: Split
): string => {
	const items: string[] = [
		`in=${descriptor.input}`,
		`stream=${descriptor.stream}`,
	];

	if (!split) {
		const d = descriptor as DescriptorForSingleFile;
		items.push(`output=${d.output}`);
	}
	else {
		const d = descriptor as DescriptorForSplitting;
		items.push(
			`init_segment=${d.outputInit}`,
			`segment_template=${d.outputMedia}`,
		)
	}

	if (descriptor.drmLabel !== undefined) {
		items.push(`drm_label=${descriptor.drmLabel}`);
	}

	return items.join(",");
}