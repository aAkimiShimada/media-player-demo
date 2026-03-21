// このファイルでは `MP4Box`, `gpac` コマンドで暗号化を行う際に使用される XML 形式の設定ファイルを構成する関数 `createCryptoFile` を実装している

import { writeTextToFile } from "~/utils/file-handle";

/**
 * `MP4Box` で暗号化したメディアを作成する際に必要な暗号化オプションを指定した XML ファイルを作成する
 *
 * 詳細なオプション指定は、引数に渡すオブジェクトにより行う
 */
export const createCryptoFile =
async (option: CreateCryptFileOption): Promise<void> => {
	// reference: https://wiki.gpac.io/xmlformats/Common-Encryption/

	/** 1つの行の内容を簡易的に表す型 */
	type Row = [depth: number, text: string];
	/** XML の内容を行単位で構成する */
	const rows: Row[] = [
		[0, `<GPACDRM type="${option.piff ? "piff" : "CENC AES-CTR"}">`],
		...option.tracks.map(track => {
			const trackAttr = (
				track.trackId == undefined ? "" :
				` trackID="${track.trackId}"`
			);

			return [
				[1, `<CrypTrack${trackAttr} IV_size="8">`],
				[2, `<Key KID="0x${track.keyId}" value="0x${track.key}" />`],
				[1, `</CrypTrack>`]
			] as Row[];
		}).flat(),
		[0, `</GPACDRM>`]
	];

	/** XML の内容を構成する */
	const src =
		rows.map(([indent, line]) => "\t".repeat(indent) + line)
		.join("\n") + "\n";

	// ファイルへの書き込みを実行する
	await writeTextToFile(option.output, src);
	console.log(`Crypt file written to ${option.output}`);
};

/** `createCryptFile` 関数のオプション */
export interface CreateCryptFileOption {
	/** XML ファイルの出力先のパス */
	output: string;
	/** トラックごとの暗号化キーのデータ */
	tracks: CryptTrack[];
	/** 暗号化スキームとして PIFF を使用する */
	piff?: boolean;
}

/** 1つのトラックに対する暗号化キーのデータ */
interface CryptTrack {
	/** 対象とする、コンテナ内のトラック番号 */
	trackId?: number;
	/**
	 * キー ID
	 * * 16進数表記で32桁
	 */
	keyId: string;
	/**
	 * キー
	 * * 16進数表記で32桁
	 */
	key: string;
};