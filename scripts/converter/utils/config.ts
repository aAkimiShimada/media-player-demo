// このファイルでは構成に関わるいくつかのデータや型を用意している

import {
	encryptedMediaPath, encryptedSegmentsDirPath,
	intermediateDirPath,
	originalPath, outputPath,
	preprocessedDirPath,
	resolutions,
	segmentsDirPath
} from "~/consts";

import { AudioCodec, Container, VideoCodec } from "~/types/convert-description";

/**
 * 成分毎の識別子
 * * 動画の映像成分/音声成分に分け、かつ映像成分も解像度毎に分けている
 * * Bento4, MP4Box, GPAC, Shaka Packager, FFmpeg などオーディオとビデオを分けて処理するツールを使用する場合に参照される
 */
export const identifiers = [
	"audio",
	...resolutions.map((_,index) => `video_${index+1}`)
] as Identifier[];

/** 映像や音声の成分の識別子を表す型を規定する */
type Identifier = "audio" | `video_${number}`;

/** 引数として渡されうるコーデック・コンテナの情報 */
type CodecContainerInfo = {
	audioCodec: AudioCodec.Type,
	videoCodec: VideoCodec.Type,
	container: Container.Type
};

/** 入出力に使われるメディアファイルパスの集合 */
export namespace paths {

	/** 入力となるメディアのパス */
	export const sourcePath = originalPath;

	/** プリプロセスを実行した直後の映像または音声ファイルのパス */
	export const preprocessed = (id: Identifier | "video", ccInfo: CodecContainerInfo) => {
		const { audioCodec, videoCodec, container } = ccInfo;

		if (id === "audio") {
			return `${preprocessedDirPath}/preprocessed_audio_${audioCodec}.${container}`;
		}
		if (id === "video") {
			return `${preprocessedDirPath}/preprocessed_video_${audioCodec}.${container}`;
		}

		// `video_${number}`
		const index = id.split("_")[1];
		return `${preprocessedDirPath}/preprocessed_video_${videoCodec}_${index}.${container}`;
	};

	/** プリプロセスを実行した直後のメディアファイルのパス */
	export const preprocessedMerged = (ccInfo: CodecContainerInfo) => {
		const { audioCodec, videoCodec, container } = ccInfo;
		return `${preprocessedDirPath}/preprocessed_${videoCodec}_${audioCodec}.${container}`;
	};

	/** プリプロセスを実行したメディアファイルが含まれるディレクトリのパス */
	export const preprocessedDir = preprocessedDirPath;

	/** 中間作業ファイルが含まれるディレクトリのパス */
	export const intermediateDir = intermediateDirPath;

	/** 出力先ディレクトリのパス */
	export const outputDir = outputPath;

	/** フラグメント化した動画ファイルのパス */
	export const fragmented =
	(id: Identifier, container: Container.Type) => (
		`${intermediateDirPath}/fragmented_${id}.${container}`
	);

	/** 暗号化した動画ファイルのパス */
	export const encrypted =
	(id: Identifier | "video", container: Container.Type) => (
		`${intermediateDirPath}/encrypted_${id}.${container}`
	);

	/** 映像または音声の暗号化オプションを構成した XML ファイルのパス */
	export const cryptXml = (id: Identifier) => (
		`${intermediateDirPath}/crypt_${id}.xml`
	);

	/** 暗号化オプションを構成した XML ファイルのパス */
	export const cryptXmlMerged = `${intermediateDirPath}/crypt.xml`;

	/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
	export const segmentsDir = (id?: Identifier) => (
		id != undefined ? `${segmentsDirPath}/${id}` : segmentsDirPath
	);

	/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ (暗号化済み) */
	export const encryptedSegmentsDir = (id?: Identifier) => (
		id != undefined ? `${encryptedSegmentsDirPath}/${id}` : encryptedSegmentsDirPath
	);

	/** 暗号化のみ実施した動画ファイルのパス */
	export const encryptedMerged = (container: Container.Type) => (
		`${encryptedMediaPath}.${container}`
	);

}