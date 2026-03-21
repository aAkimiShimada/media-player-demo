// このファイルでは Shaka Packager を使った変換処理の内容を構成している

import {
	packager,
	type PackagerEncryptionKey,
	type PackagerStreamDescriptor
} from "./command";

import { encryptionKeys, segmentDuration } from "~/consts";

import { ffmpeg } from "~/ffmpeg/command";
import { preprocess } from "~/ffmpeg/preprocess";

import { Container, type ConvertDescriptionShakaPackager } from "~/types/convert-description";

import { identifiers, paths } from "~/utils/config";
import { makeDirs } from "~/utils/file-handle";
import { forEach } from "~/utils/misc";

/**
 * Shaka Packager を使った処理を実装する
 * * 引数に `ConvertDescription` 型の構成を渡す
 */
export const packagerTemplate = async (cd: ConvertDesc1) => {
	// `runMode` の値によって場合分けして、それぞれの該当する関数を呼び出す。
	switch (cd.runMode) {
		case "mse": {
			await templateMse(cd);
		} break;
		case "mse+eme": {
			await templateMseEme(cd);
		} break;
		case "eme": {
			await templateEme(cd);
		} break;
	}
};

/**
 * `ConvertDescription` 型のうち、 Shaka Packager を使った処理に関係のある情報のみを残した、内部でのみ使用する型
 *
 * この型定義により、 Shaka Packager を使った処理に必要な情報を明示している。
 */
type ConvertDesc1 = Pick<
	ConvertDescriptionShakaPackager,
	"container" | "videoCodec" | "audioCodec" | "runMode" | "pssh" | "skipPreprocess" | "emitMpd"
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
		container: cd.container,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 入出力の関係を示すディスクリプタを用意する
	type Descriptors = PackagerStreamDescriptor<true>[];
	const descriptors: Descriptors = await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, cd);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.segmentsDir(id);

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// ストリームの形式
		const streamType = id === "audio" ? "audio" : "video";

		// セグメントの拡張子
		const initSegExt = cd.container;
		const mediaSegExt = cd.container === Container.MP4 ? "m4s" : cd.container;

		// ディスクリプタを構成する
		const descriptor: PackagerStreamDescriptor<true> = {
			input: preprocessed,
			stream: streamType,
			outputInit: `${splitted}/init.${initSegExt}`,
			outputMedia: `${splitted}/seg-$Number$.${mediaSegExt}`
		};

		return descriptor;
	});

	/** MPD 出力を行う場合の出力先のパス */
	const mpdPath = `${paths.segmentsDir()}/stream.mpd`;

	// セグメント毎に別々のファイルに分ける
	await packager({
		streamDescriptors: descriptors,
		split: true,
		outputMpd: cd.emitMpd ? mpdPath : undefined,
		splitDuration: segmentDuration,
		fragmentDuration: segmentDuration,
		indexStartNumber: 1
	});
};

/** MSE と EME が利用可能になるように、セグメント分けと暗号化を行う処理を記述する */
const templateMseEme = async (cd: ConvertDesc2) => {
	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: cd.container,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 入出力の関係を示すディスクリプタと暗号化キーを用意する
	type Pairs = [
		descriptor: PackagerStreamDescriptor<true>,
		key: PackagerEncryptionKey
	][];
	const pairs: Pairs = await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, cd);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.encryptedSegmentsDir(id);

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// ストリームの形式
		const streamType = id === "audio" ? "audio" : "video";

		// セグメントの拡張子
		const initSegExt = cd.container;
		const mediaSegExt = cd.container === Container.MP4 ? "m4s" : cd.container;

		// ディスクリプタを構成する
		const descriptor: PackagerStreamDescriptor<true> = {
			input: preprocessed,
			stream: streamType,
			drmLabel: id,
			outputInit: `${splitted}/init.${initSegExt}`,
			outputMedia: `${splitted}/seg-$Number$.${mediaSegExt}`
		};

		// 暗号化キーを用意する
		const key: PackagerEncryptionKey = {
			label: id,
			...(
				id === "audio" ?
				encryptionKeys.audio : encryptionKeys.video
			)
		};

		return [descriptor, key];
	});

	/** MPD 出力を行う場合の出力先のパス */
	const mpdPath = `${paths.encryptedSegmentsDir()}/stream.mpd`;

	// セグメント毎に別々のファイルに分ける
	await packager({
		streamDescriptors: pairs.map(pair => pair[0]),
		encryptionKeys: pairs.map(pair => pair[1]),
		split: true,
		outputMpd: cd.emitMpd ? mpdPath : undefined,
		pssh: cd.pssh,
		splitDuration: segmentDuration,
		fragmentDuration: segmentDuration,
		indexStartNumber: 1
	});
};

/** EME が利用可能になるように、暗号化を行う処理を記述する */
const templateEme = async (cd: ConvertDesc2) => {
	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: cd.container,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: true,
		singleResolution: true,
		disableKeyframeAdjust: true
	});

	/** プリプロセスを実行した直後の動画ファイルのパス */
	const preprocessed = paths.preprocessedMerged(cd);
	/** 映像のみの暗号化した動画ファイルのパス */
	const encryptedVideo = paths.encrypted("video", cd.container);
	/** 音声のみの暗号化した動画ファイルのパス */
	const encryptedAudio = paths.encrypted("audio", cd.container);
	/** 暗号化した動画ファイルのパス */
	const encrypted = paths.encryptedMerged(cd.container);

	// 暗号化する
	await packager({
		streamDescriptors: [
			{
				input: preprocessed,
				output: encryptedVideo,
				stream: "video",
				drmLabel: "video",
			},
			{
				input: preprocessed,
				output: encryptedAudio,
				stream: "audio",
				drmLabel: "audio"
			}
		],
		encryptionKeys: [
			{
				label: "video",
				...encryptionKeys.audio
			},
			{
				label: "audio",
				...encryptionKeys.video
			}
		],
		pssh: cd.pssh
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	// 暗号化した後に FFmpeg を使って統合する
	await ffmpeg({
		input: [encryptedVideo, encryptedAudio],
		videoCodec: "copy",
		audioCodec: "copy",
		output: encrypted
	});
};