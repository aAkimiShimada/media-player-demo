// このファイルでは Bento4 を使った変換処理の内容を構成している

import {
	convertToFragment,
	splitFragment,
	encrypt,
	createDashSegments, type CreateDashInputFile
} from "./commands";

import { encryptionKeys, segmentDuration } from "~/consts";

import { preprocess } from "~/ffmpeg/preprocess";

import { Container, type ConvertDescriptionBento4 } from "~/types/convert-description";

import { identifiers, paths } from "~/utils/config";
import { makeDirs } from "~/utils/file-handle";
import { forEach } from "~/utils/misc";

/**
 * Bento4 を使った処理を実装する
 * * 引数に `ConvertDescription` 型の構成を渡す
 */
export const bento4Template = async (cd: ConvertDesc1) => {
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
 * `ConvertDescription` 型のうち、 Bento4 を使った処理に関係のある情報のみを残した、内部でのみ使用する型
 *
 * この型定義により、 Bento4 を使った処理に必要な情報を明示している。
 */
type ConvertDesc1 = Pick<
	ConvertDescriptionBento4,
	"videoCodec" | "audioCodec" | "runMode" | "pssh" | "piff" | "direct" | "skipPreprocess"
>;

/**
 * `ConvertDescription` 型のうち、実行モードの情報を取り除いた、内部でのみ使用する型
 *
 * この型定義により、モードによる振り分けをした後の実際の処理において必要な情報を明示している。
 */
type ConvertDesc2 = Omit<ConvertDesc1, "runMode" | "direct">;

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
		/** フラグメント化した動画ファイルのパス */
		const fragmented = paths.fragmented(id, Container.MP4);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.segmentsDir(id);

		// フラグメントに分ける
		await convertToFragment({
			input: preprocessed,
			output: fragmented,
			duration: segmentDuration
		});

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// セグメント毎に別々のファイルに分ける
		await splitFragment({
			input: fragmented,
			outputInit: `${splitted}/init.mp4`,
			outputMedia: `${splitted}/seg-%llu.m4s`,
			indexStartNumber: 1
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
		/** フラグメント化した動画ファイルのパス */
		const fragmented = paths.fragmented(id, Container.MP4);
		/** 暗号化した動画ファイルのパス */
		const encrypted = paths.encrypted(id, Container.MP4);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.encryptedSegmentsDir(id);

		// フラグメントに分ける
		await convertToFragment({
			input: preprocessed,
			output: fragmented,
			duration: segmentDuration
		});

		// 暗号化キーを選択する
		const keyPair =
			id === "audio" ?
			encryptionKeys.audio :
			encryptionKeys.video;

		// 暗号化する
		await encrypt({
			input: fragmented,
			output: encrypted,
			pssh: cd.pssh,
			keys: [
				{ trackNo: 1, ...keyPair }
			]
		});

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// セグメント毎に別々のファイルに分ける
		await splitFragment({
			input: encrypted,
			outputInit: `${splitted}/init.mp4`,
			outputMedia: `${splitted}/seg-%llu.m4s`,
			indexStartNumber: 1
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

	/** プリプロセスを実行した直後の動画ファイルのパス */
	const preprocessed = paths.preprocessedMerged({ ...cd, container: Container.MP4 });
	/** 暗号化した動画ファイルのパス */
	const encrypted = paths.encryptedMerged(Container.MP4);

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.outputDir);

	// 暗号化する
	await encrypt({
		input: preprocessed,
		output: encrypted,
		pssh: cd.pssh,
		keys: [
			{
				trackNo: 1,
				...encryptionKeys.video
			},
			{
				trackNo: 2,
				...encryptionKeys.audio
			},
		]
	});
};

/**
 * MSE が利用可能になるように、セグメント分けを行う処理を記述する
 *
 * プリプロセスの後の処理をある程度まとめて行い、 MPD ファイルを生成する。
 * */
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

	// それぞれの成分毎の処理を並列に実行する
	const inputFiles = await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, { ...cd, container: Container.MP4 });
		/** フラグメント化した動画ファイルのパス */
		const fragmented = paths.fragmented(id, Container.MP4);

		// フラグメントに分ける
		await convertToFragment({
			input: preprocessed,
			output: fragmented,
			track: id === "audio" ? "audio" : "video",
			duration: segmentDuration
		});

		// この後のセグメント分けで入力ファイルとして渡す情報を用意する
		return {
			path: fragmented,
			type: id === "audio" ? "audio" : "video",
			representationId: id
		} as CreateDashInputFile;
	});

	/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
	const splittedDir = paths.segmentsDir();

	// セグメント毎のファイルの出力先ディレクトリを生成する
	await makeDirs(splittedDir);

	// セグメント分けと MPD 生成を行う
	await createDashSegments({
		input: inputFiles,
		outputDir: splittedDir,
		mpdName: "stream.mpd"
	});
};

/**
 * MSE と EME が利用可能になるように、セグメント分けと暗号化を行う処理を記述する
 *
 * プリプロセスの後の処理をある程度まとめて行い、 MPD ファイルを生成する。
 * */
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
	const inputFiles: CreateDashInputFile[] = await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, { ...cd, container: Container.MP4 });
		/** フラグメント化した動画ファイルのパス */
		const fragmented = paths.fragmented(id, Container.MP4);
		/** 暗号化した動画ファイルのパス */
		const encrypted = paths.encrypted(id, Container.MP4);

		// フラグメントに分ける
		await convertToFragment({
			input: preprocessed,
			output: fragmented,
			track: id === "audio" ? "audio" : "video",
			duration: segmentDuration
		});

		// 暗号化キーを選択する
		const keyPair =
			id === "audio" ?
			{ trackNo: 2, ...encryptionKeys.audio } :
			{ trackNo: 1, ...encryptionKeys.video };

		// 暗号化する
		await encrypt({
			input: fragmented,
			output: encrypted,
			keys: [keyPair]
		});

		// この後のセグメント分けで入力ファイルとして渡す情報を用意する
		return {
			path: encrypted,
			type: id === "audio" ? "audio" : "video",
			representationId: id
		};
	});

	/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
	const splittedDir = paths.encryptedSegmentsDir();

	// セグメント毎のファイルの出力先ディレクトリを生成する
	await makeDirs(splittedDir);

	// セグメント分けと MPD 生成を行う
	await createDashSegments({
		input: inputFiles,
		outputDir: splittedDir,
		mpdName: "stream.mpd"
	});
};