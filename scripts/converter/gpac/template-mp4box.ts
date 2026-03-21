// このファイルでは MP4Box を使った変換処理の内容を構成している

import {
	type MP4BoxInputFile,
	mp4box
} from "./command-mp4box";
import { createCryptoFile } from "./create-crypt-file";

import { encryptionKeys, segmentDuration } from "~/consts";

import { preprocess } from "~/ffmpeg/preprocess";

import { Container, type ConvertDescriptionMP4Box } from "~/types/convert-description";

import { identifiers, paths } from "~/utils/config";
import { makeDirs } from "~/utils/file-handle";
import { forEach } from "~/utils/misc";

/**
 * MP4Box を使った処理を実装する
 * * 引数に `ConvertDescription` 型の構成を渡す
 */
export const mp4boxTemplate = async (cd: ConvertDesc1) => {
	// `runMode`, `direct` の値によって場合分けして、それぞれの該当する関数を呼び出す。
	switch (cd.runMode) {
		case "mse": {
			if (cd.direct) await templateMseDirect(cd);
			else await templateMse(cd);
		} break;
		case "mse+eme": {
			if (cd.direct) await templateMseEmeDirect(cd);
			else await templateMseEme(cd);
		} break;
		case "eme": {
			await templateEme(cd);
		} break;
	}
};

/**
 * `ConvertDescription` 型のうち、 MP4Box を使った処理に関係のある情報のみを残した、内部でのみ使用する型
 *
 * この型定義により、 MP4Box を使った処理に必要な情報を明示している。
 */
type ConvertDesc1 = Pick<
	ConvertDescriptionMP4Box,
	"videoCodec" | "audioCodec" | "runMode" | "pssh" | "piff" | "direct" | "skipPreprocess"
>;

/**
 * `ConvertDescription` 型のうち、実行モードの情報を取り除いた、内部でのみ使用する型
 *
 * この型定義により、モードによる振り分けをした後の実際の処理において必要な情報を明示している。
 */
type ConvertDesc2 = Omit<ConvertDesc1, "runMode">;

/** MSE が利用可能になるように、セグメント分けを行う処理を記述する */
const templateMse = async (cd: ConvertDesc2) => {
	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: Container.MP4,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	// それぞれの成分毎の処理を並列に実行する
	await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, { ...cd, container: Container.MP4 });
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.segmentsDir(id);
		/** MPD ファイルのパス */
		const dash = `${splitted}/stream.mpd`;

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// セグメント毎に別々のファイルに分ける
		await mp4box({
			dash: true,
			input: [ {
				path: preprocessed,
				kind: id === "audio" ? "audio" : "video",
				representationId: id
			} ],
			outputDashPath: dash,
			outputInitName: "init",
			outputMediaName: "seg-$Number$",
			fragmentDuration: segmentDuration,
			splitDuration: segmentDuration
		});
	});
};

/** MSE と EME が利用可能になるように、セグメント分けと暗号化を行う処理を記述する */
const templateMseEme = async (cd: ConvertDesc2) => {
	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: Container.MP4,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	// それぞれの成分毎の処理を並列に実行する
	await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, { ...cd, container: Container.MP4 });
		/** 暗号化オプションを構成した XML ファイルのパス */
		const cryptXml = paths.cryptXml(id);
		/** 暗号化した動画ファイルのパス */
		const encrypted = paths.encrypted(id, Container.MP4);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.encryptedSegmentsDir(id);
		/** MPD ファイルのパス */
		const dash = `${splitted}/stream.mpd`;

		// 暗号化キーを選択する
		const keyPair =
			id === "audio" ?
			encryptionKeys.audio :
			encryptionKeys.video;

		// 暗号化オプションを定義した XML ファイルを作成する
		await createCryptoFile({
			output: cryptXml,
			piff: cd.piff,
			tracks: [ {
				trackId: 1,
				...keyPair
			} ]
		});

		// 暗号化する
		await mp4box({
			input: preprocessed,
			output: encrypted,
			cryptFile: cryptXml
		});

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// セグメント毎に別々のファイルに分ける
		await mp4box({
			dash: true,
			pssh: cd.pssh,
			input: [ {
				path: encrypted,
				kind: id === "audio" ? "audio" : "video",
				representationId: id
			} ],
			outputDashPath: dash,
			outputInitName: "init",
			outputMediaName: "seg-$Number$",
			fragmentDuration: segmentDuration,
			splitDuration: segmentDuration
		});
	});
};

/** EME が利用可能になるように、暗号化を行う処理を記述する */
const templateEme = async (cd: ConvertDesc2) => {
	// プリプロセス処理を実行する
	if (!cd.skipPreprocess) await preprocess({
		container: Container.MP4,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: true,
		singleResolution: true,
		disableKeyframeAdjust: true
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	/** プリプロセスを実行した直後の動画ファイルのパス */
	const preprocessed = paths.preprocessedMerged({ ...cd, container: Container.MP4 });
	/** 暗号化オプションを構成した XML ファイルのパス */
	const cryptXml = paths.cryptXmlMerged;
	/** 暗号化した動画ファイルのパス */
	const encrypted = paths.encryptedMerged(Container.MP4);

	// 暗号化オプションを定義した XML ファイルを作成する
	await createCryptoFile({
		output: cryptXml,
		piff: cd.piff,
		tracks: [
			{
				trackId: 1,
				...encryptionKeys.video
			},
			{
				trackId: 2,
				...encryptionKeys.audio
			},
		]
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.outputDir);

	// 暗号化する
	await mp4box({
		input: preprocessed,
		output: encrypted,
		pssh: cd.pssh,
		cryptFile: cryptXml
	});
};

/**
 * MSE が利用可能になるように、セグメント分けを行う処理を記述する
 *
 * プリプロセスの後の処理をある程度まとめて行い、単一の MPD ファイルを生成する
 */
const templateMseDirect = async (cd: ConvertDesc2) => {
	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: Container.MP4,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	// この後のセグメント分割で必要な入力ファイルの情報を用意する
	const inputFiles = await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, { ...cd, container: Container.MP4 });
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.segmentsDir(id);

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		return {
			path: preprocessed,
			kind: id === "audio" ? "audio" : "video",
			representationId: id
		} as MP4BoxInputFile;
	});

	/** MPD ファイルのパス */
	const dash = `${paths.segmentsDir()}/stream.mpd`;

	// セグメント分けと MPD 生成を行う
	await mp4box({
		dash: true,
		pssh: cd.pssh,
		input: inputFiles,
		outputDashPath: dash,
		outputMediaName: "$RepresentationID$/seg-$Number$",
		fragmentDuration: segmentDuration,
		splitDuration: segmentDuration
	});
};

/**
 * MSE と　EME が利用可能になるように、セグメント分けを行う処理を記述する
 *
 * プリプロセスの後の処理をある程度まとめて行い、単一の MPD ファイルを生成する
 */
const templateMseEmeDirect = async (cd: ConvertDesc2) => {
	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: Container.MP4,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	// それぞれの成分毎の処理を並列に実行する
	const inputFiles: MP4BoxInputFile[] = await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, { ...cd, container: Container.MP4 });
		/** 暗号化オプションを構成した XML ファイルのパス */
		const cryptXml = paths.cryptXml(id);
		/** 暗号化した動画ファイルのパス */
		const encrypted = paths.encrypted(id, Container.MP4);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.encryptedSegmentsDir(id);

		// 暗号化キーを選択する
		const keyPair =
			id === "audio" ?
			encryptionKeys.audio :
			encryptionKeys.video;

		// 暗号化オプションを定義した XML ファイルを作成する
		await createCryptoFile({
			output: cryptXml,
			piff: cd.piff,
			tracks: [ {
				trackId: 1,
				...keyPair
			} ]
		});

		// 暗号化する
		await mp4box({
			input: preprocessed,
			output: encrypted,
			cryptFile: cryptXml
		});

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// この後のセグメント分けで入力ファイルとして渡す情報を用意する
		return {
			path: preprocessed,
			kind: id === "audio" ? "audio" : "video",
			representationId: id
		};
	});

	/** MPD ファイルのパス */
	const dash = `${paths.encryptedSegmentsDir()}/stream.mpd`;

	// セグメント分けと MPD 生成を行う
	await mp4box({
		dash: true,
		pssh: cd.pssh,
		input: inputFiles,
		outputDashPath: dash,
		outputMediaName: "$RepresentationID$/seg-$Number$",
		fragmentDuration: segmentDuration,
		splitDuration: segmentDuration
	});
};