// このファイルは動画プレーヤのための各種処理のエントリーポイントとして機能する

import { enableMSE, enableEME } from "./consts";
import { setupMSE } from "./mse";
import { setupEME } from "./eme";
import { removeSource as removeSourceElements, registerEventHandlers } from "./misc";
import { ERROR } from "./log";
import { setupInterface } from "./interface";

/**
 * 動画プレーヤーのセットアップを行う処理のエントリポイント
 */
const main = () => {
	/** プレーヤーとなる `video` 要素 */
	const video = document.querySelector("video");
	// 一応エラーハンドリング
	if (video == null) {
		ERROR("video 要素が見つかりませんでした");
		return;
	}

	// インターフェースを構築
	if (enableMSE || enableEME) setupInterface();

	// `source` 要素を全て削除
	if (enableMSE) removeSourceElements(video);

	// コンソールへの通知用にイベントハンドラを設定
	if (enableMSE || enableEME) registerEventHandlers(video);

	// MSE API のセットアップを行う
	if (enableMSE) setupMSE(video);

	// EME API のセットアップを行う
	if (enableEME) setupEME(video);
};

// HTML の読み込みが完了した時点で `main` を実行するように設定
window.addEventListener("load", main);