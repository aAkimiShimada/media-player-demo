// このファイルは、動画コンバータのエントリポイントを構成している
// 使用する処理を選択して実行する

import {
	create_demo_of_mse,
	create_demo_of_mse_eme,
	create_demo_of_eme
} from "./template";
import {
	create_demo_of_mse_dash,
	create_demo_of_mse_eme_dash
} from "./template_dash";

/**
 * 動画コンバータのエントリーポイントを規定しています。
 *
 * 事前に用意された処理内容のテンプレートのうち1つを選択して `main` 関数内に記載して使用します。
 *
 * 例) `create_demo_of_mse` を選択する場合
 *
 * ```JavaScript
 * const main = async () => {
 *     await create_demo_of_mse();
 * };
 * ```
 */
const main = async () => {

	// 以下に処理テンプレートの名前を1つだけ記載します。

	await create_demo_of_mse();

	// 選択肢
	//
	// * `create_demo_of_mse`
	//     * MSE のみを使う形に動画ファイルを変換します
	// * `create_demo_of_mse_eme`
	//     * MSE  + EME の両方を使う形に動画ファイルを変換します
	// * `create_demo_of_eme`
	//     * EME のみを使う形に動画ファイルを変換します
	// * `create_demo_of_mse_dash`
	//     * MSE のみを使う形に動画ファイルを変換します
	//     * DASH の形式になっています
	// * `create_demo_of_mse_eme_dash`
	//     * MSE  + EME の両方を使う形に動画ファイルを変換します
	//     * DASH の形式になっています

};

// 実行開始
main().catch(console.error);