media-player-demo
---

ストリーミングに MSE API を、暗号化した動画の再生に EME API (Clear Key キーシステム) を使った簡単な動画配信サーバと動画プレーヤーを実装しています。

## 特徴

* MSE API や EME API を使ってブラウザ上でストリーミングや暗号化した動画を再生するための実装が用意されています。
	* ストリーミングの方は動画プレーヤーの操作に応じて適切なセグメントが取得できるように多少工夫されています。
	* ソースコード中のフラグを切り替えるだけで MSE の機能を利用するか否か、 EME の機能を利用するか否かが簡単に切り替えられます。
		* 簡単に切り替えられるようにコードが機能ごとに集約されています。
	* ストリーミングの再生状況が表示されるパネルの UI が用意されています。 MSE API を有効にするとこの機能にアクセスできます。
	* MSE API や EME API の機能の利用状況が事細かにログに出力されます。
	* スクリプティングは TypeScript で書かれており、これをトランスパイルすることでブラウザで実行可能な JavaScript にします。
		* しかもトランスパイルにおいて、 TypeScript のコード構造をなるべく崩さないように (= minify しないように) 変換しているので、 TypeScript でも JavaScript でもコードが見やすい状態で編集できるようになっています。
		* Babel のトランスパイラで TypeScript から JavaScript への変換を行っていますが、それだけでは不完全なので、トランスパイル後の JavaScript コードを適切に修正するスクリプトも含まれており、これが実行されます。
* ストリーミング (MSE API) のためのセグメントに分かれた動画や、暗号化した動画 (EME API) の生成を行うためのスクリプトが用意されています。
	* ストリーミングの有無や、暗号化の有無に合わせて、スクリプトの処理内容を切り替えて実行できるようになっています。
	* 動画ファイルの長さや暗号化キーなど、スクリプトの依存するパラメータは1つのファイルにまとめられています。
* Express により構築された簡易的なサーバープログラムが用意されています。
	* 通信環境が悪化した状況をエミュレーションするための機能も備えています。
* 全体的にソースコードは内容が理解しやすくなるように整頓され、コメントが適宜追加されています。
* ブラウザ上で動作するJSコードや、動画生成スクリプト、サーバ起動のコードはどれも TypeScript で書かれています。
* **ソースコードはかなり歯抜け状態になっており、そのままでは動作しないようになっています。**
	* この後のセクション「流れ」に従って作業を進めることで再生できるようになります。
	* 元々[株式会社 ACCESS](https://www.access-company.com) における新卒研修課題として用意されたものであり、研修時に穴埋めしながら作業することを想定していたためです。

## 必要なもの

### ソフトウェア

* Node.js  
	このリポジトリは NPM パッケージになっています。
* FFmpeg
* Bento4  
	動画ファイルのフラグメント化や暗号化に必要です。
* 最新のブラウザ  
	* Chromium 系 or Firefox で動作します。
	* Safari だと Clear Key キーシステムに対応していないため、 EME API の動作テストができません。

### コンテンツ

* 動画ファイル
	* 映像と音声が両方含まれているもの
	* H.264 + AAC でエンコードされた `.mp4` (MPEG-4) コンテナフォーマット
		* 詳しい方法は説明しませんが、他のコーデックやコンテナの動画ファイルがあっても FFmpeg を使用すればこのコーデック、コンテナに変換することはできます。
	* 動画ファイルの長さは特に指定しませんが、用いる動画ファイルの長さに合わせて `ts_src/consts.ts` と `scripts/converter/consts.ts` の両方の値を適切に書き換える必要があります。

## 基本的な使い方

まず最初に必要なパッケージをインストールしてください。

```shell
npm install
```

### 流れ

以下の流れで操作することになると思われます。

1. 対象となる動画ファイルを用意する。
2. 動画の変換スクリプトを書き換えて実行する。
3. フロントエンド TypeScript を編集する。
4. フロントエンド TypeScript をトランスパイルする。
5. サーバーを起動する。
6. ブラウザで Web ページを表示する。

### 動画の変換

予め対象の動画ファイルを `media/movie.mp4` に移動します。  
動画ファイルは H.264 + AAC でエンコードされている必要があります。

```
mv /path/to/movie.mp4 media/movie.mp4
```

そして変換は以下のコマンドから行えます。

```shell
npm run convert
```

標準ではストリーミングのみに対応した変換処理しか行われないようになっているので、暗号化を体験したい場合などはコードを書き換える必要があります。

### フロントエンドのトランスパイル

フロントエンドの TypeScript コードは以下のコマンドにより JavaScript に変換できます。

```shell
npm run build
```

### サーバーの起動

サーバーの起動は以下のコマンドから行えます。

```shell
npm run serve
```

通信環境が悪化したり改善したりする状況をエミュレーションするサーバを起動するのは以下のコマンドから行えます。

```shell
npm run serve-throttling
```

## 作業手順

初期状態ではストリーミングや暗号化は無効化されています。なのでこれらの機能を試すには手動でコードを書き換える必要があります。

### ストリーミングを有効化する手順

1. 対象とする動画ファイルを `media/movie.mp4` に置く

	```shell
	mv /path/to/your-movie.mp4 media/movie.mp4
	```

2. 動画ファイルをセグメントで分割した形に変換する  
	生成したセグメントは `media/segments` ディレクトリ内に保存されます。

	```shell
	npm run convert
	```

3. `index.html` を開き、 `video` 要素に含まれる `source` 要素を消します。

	```diff
	   <body>
	     <video controls>
	-      <source src="media/movie.mp4" type="video/mp4" />
	     </video>
	   </body>
	 </html>
	```

4. `ts_src/consts.ts` を開き、 3. で生成したセグメントが読み込まれるようにパスを指定する  
	以下の `getVideoSegmentUrl` と `getAudioSegmentUrl` はそれぞれ要求された解像度やセグメントの情報から、適切なセグメントのパスを返すことを期待される関数です。 3. で生成されたセグメントを確認して適切なパスを返すように書いてください。  
	`segmentIndex` として `-1` が渡された場合は初期セグメント `init.mp4` が渡されることが期待され、 `0` より大きな値ではセグメント本体 `seg-*.m4s` が返されることが期待されます。

	```typescript
	const getVideoSegmentUrl = (
	  // 解像度番号 (1, 2, 3, 4, 5)
	  resIndex: number,    
	  // セグメント番号 (-1, 0, 1, 2, …)
	  segmentIndex: number
	): string => {
	  // TODO: これから実装する
	  return "";
	};
	
	const getAudioSegmentUrl = (
	  // セグメント番号 (-1, 0, 1, 2, …)
	  segmentIndex: number
	): string => {
	  // TODO: これから実装する
	  return "";
	};
	```

5. `ts_src/consts.ts` で MSE の機能を有効化する  
	単純にブール値 `enableMSE` を `true` に設定するだけで使用できるようになります。

	```diff
	 /** MSE API の機能の有効/無効を切り替える */
	-export const enableMSE: boolean = false;
	+export const enableMSE: boolean = true;
	 
	 /** EME API の機能の有効/無効を切り替える */
	 export const enableEME: boolean = false;
	 
	 /** 解像度の「自動」設定の有効/無効を切り替える */
	 export const enableAutoResolution: boolean = false;
	```

6. トランスパイルの実行

	```shell
	npm run build
	```

7. サーバーを起動  
	既にこのコマンドでサーバーを起動している場合は、新たに行う操作はありません。

	```shell
	npm run serve
	```

8. ブラウザで再読み込みすることでストリーミングを使った動画プレーヤーが利用できるようになります。

### 暗号化を有効化する手順

※ 以下の手順は既に上記の「ストリーミングを有効化する手順」を実行していることを前提としています。

1. 暗号化に使用する鍵を作成する  
	16進数で32桁の文字列を4つ用意します。

	```shell
	openssl rand -hex 16
	openssl rand -hex 16
	openssl rand -hex 16
	openssl rand -hex 16
	```

2. 暗号化した動画セグメントを生成するにあたり、 1. で用意した暗号化鍵を変換スクリプトの `scripts/converter/consts.ts` の変数 `encryptionKeys` にセットする。  
	4種類のキーは 映像の `keyId` と `key` 、音声の `keyId` と `key` にそれぞれ割り当てます。

	```diff
	 /** 暗号化キーの設定 */
	 export const encryptionKeys: EncryptionKeys = {
	   video: {
	-    keyId: "",
	-    key: ""
	+    keyId: "映像の keyId をここにセットします",
	+    key: "映像の key をここにセットします"
	   },
	   audio: {
	-    keyId: "",
	-    key: ""
	+    keyId: "音声の keyId をここにセットします",
	+    key: "音声の key をここにセットします"
	   }
	 };
	```

3. `scripts/converter/main.ts` を開き、暗号化した動画セグメントが生成されるように `main` 関数で指定された処理内容を変更する。  
	標準では暗号化していないセグメントを生成する処理が実行できるように準備されているので、変更する必要がある。  
	引数で `true` を与えることで、「ストリーミングを有効化する手順」でセグメント生成に使用した中間生成ファイル (`media/intermediates`) を再利用する。

	```diff
	 const main = async () => {
	-  await create_demo_of_mse();
	+  await create_demo_of_mse_eme(true);
	 };
	```

4. 暗号化したセグメント生成処理を実行する  
	上記のステップ 2., 3. により暗号化したセグメントを生成する準備は整っています。  
	生成したセグメントは `media/segments` の代わりに `media/segments_encrypted` に保存されます。  
	`segments_encrypted` 内のファイルツリー構造は `segments` と同じです。

	```shell
	npm run convert
	```

5. フロントエンド実装の `ts_src/consts.ts` を開き、関数 `getVideoSegmentUrl` と `getAudioSegmentUrl` のパスを書き換える  
	セグメントが保存される場所が変更されたので、以下のパス例のように適切なパスが返されるように関数の実装を変更する必要があります。  
	単純に `segments` を `segments_encrypted` に書き換えるだけで問題ありません。

	```diff
	- media/segments/video_1/seg-10.m4s
	+ media/segments_encrypted/video_1/seg-10.m4s
	```

6. `ts_src/consts.ts` を開き、ステップ 2. と同様に変数 `encryptionKeys` に暗号化鍵をセットする

	```diff
	 /** 暗号化キー */
	 export const encryptionKeys: EncryptionKeys = {
	   video: {
	-    keyId: "",
	-    key: ""
	+    keyId: "映像の keyId をここにセットします",
	+    key: "映像の key をここにセットします"
	   },
	   audio: {
	-    keyId: "",
	-    key: ""
	+    keyId: "音声の keyId をここにセットします",
	+    key: "音声の key をここにセットします"
	   }
	 };
	```

7. `ts_src/consts.ts` を開き EME の機能を有効化する  
	単純にブール値 `enableEME` を `true` に設定するだけで使用できるようになります。

	```diff
	 /** MSE API の機能の有効/無効を切り替える */
	 export const enableMSE: boolean = true;
	 
	 /** EME API の機能の有効/無効を切り替える */
	-export const enableEME: boolean = false;
	+export const enableEME: boolean = true;
	 
	 /** 解像度の「自動」設定の有効/無効を切り替える */
	 export const enableAutoResolution: boolean = false;
	```

8. トランスパイルの実行

	```shell
	npm run build
	```

9. サーバーを起動  
	既にこのコマンドでサーバーを起動している場合は、新たに行う操作はありません。

	```shell
	npm run serve
	```

10. ブラウザで再読み込みすることで暗号化した動画に対するストリーミングを使った動画プレーヤーが利用できるようになります。

### 解像度の「自動」モードを有効化する手順

アダプティブストリーミングの簡単な例として、解像度を自動で変更する機能が試せるようになっている。  
動画コンバートなどでは新たに行う操作はありません。  
※ 以下の手順は既に上記の「ストリーミングを有効化する手順」を実行していることを前提としています。

1. `ts_src/consts.ts` を開き、関数 `getOptimalResolution` で解像度を適切に返す実装を行う。  
	この関数は解像度変更が必要になった場合に、現在の再生状況をオブジェクトとして渡したときに、そのデータに基づき最適な解像度番号が返されることが期待される。

	```typescript
	const getOptimalResolution = (
	  // 再生状況を表すオブジェクト
	  playerState: PlayerState
	): number => {
	  // TODO: これから実装する
	  return 1;
	  // 選択する解像度番号 (1, 2, 3, 4, 5) を返す
	  // 1: 低解像度  ~  5: 高解像度
	};
	```

	引数のオブジェクト `playerState` は以下の仕様になっています。

	```typescript
	interface PlayerState {
	  // 現在の再生位置 (秒)
	  currentTime: number;
	  // 最後に読み込みが完了したセグメントのインデクス番号
	  lastLoadedSegmentIndex: number;
	  // 次に読み込む予定のセグメントのインデクス番号
	  nextLoadingSegmentIndex: number;
	  // 現在の解像度設定
	  // 未定の場合は `null` になる
	  resolution: Resolution | null;
	  // オフライン扱いをするかどうか
	  // セグメントの取得が滞るとオフラインと判定する
	  isOffline: boolean;
	};
	```

2. `ts_src/consts.ts` を開き、自動解像度の機能を有効化する  
	単純にブール値 `enableEME` を `true` に設定するだけで使用できるようになります。

	```diff
	 /** MSE API の機能の有効/無効を切り替える */
	 export const enableMSE: boolean = true;
	 
	 /** EME API の機能の有効/無効を切り替える */
	 export const enableEME: boolean = true;
	 
	 /** 解像度の「自動」設定の有効/無効を切り替える */
	-export const enableAutoResolution: boolean = false;
	+export const enableAutoResolution: boolean = true;
	```

3. トランスパイルの実行

	```shell
	npm run build
	```

4. サーバーを起動  
	既にこのコマンドでサーバーを起動している場合は、新たに行う操作はありません。

	```shell
	npm run serve
	```

5. ブラウザで再読み込みすることで、解像度として「自動」が選択できるようになった動画プレーヤーが利用できるようになります。

## ディレクトリ構成

* `package.json`  
	NPM パッケージの情報が書かれています。
* `babel.config.json`  
	トランスパイルに使用する Babel の設定が書かれています。
* `tsconfig.json`  
	TypeScript の設定が書かれています。  
	ただし実際には `tsconfig*.json` で設定の詳細を書いています。
* `.editorconfig`  
	EditorConfig を使ったエディタ設定を記載しています。
* `tsconfig.web.json`  
	フロントエンドの TypeScript コードの設定が書かれています。
* `index.html`  
	フロントエンドの HTML ページです。
* `resources`  
	画像やスタイルシートが含まれています。
* `js_src`  
	フロントエンドで実行される JavaScript コードが含まれています。  
	モジュール形式でインポートされます。
* `ts_src`  
	フロントエンドの JavaScript に対応する TypeScript コードです。  
	トランスパイルして `js_src` に保存されます。
* `scripts`  
	各種スクリプトファイルが保存されたディレクトリです。
	* `clean_files.ts`  
		トランスパイル時に生成される JavaScript コードを少し修正するためのスクリプトです。
	* `server.ts`  
		サーバーを起動させるスクリプトです。
	* `regex_lib.ts`  
		`clean_files.ts` と `server.ts` で使用される、正規表現のツールを提供するスクリプトです。
	* `converter`  
		動画変換の処理を行うスクリプトがまとめられたディレクトリです。
	* `tsconfig.*.json`  
		それぞれのスクリプトに対応する TypeScript コードの設定が書かれています。
* `media`  
	動画ファイルが保存されるディレクトリです。
	* `movie.mp4`  
		元となる変換前の動画ファイルです。
	* `segments`  
		MSE のみを使用する場合のセグメントに分かれた動画ファイルはこの名前のディレクトリに保存されます。
	* `segments_encrypted`  
		MSE + EME を使用する場合のセグメントに分かれた暗号化した動画ファイルはこの名前のディレクトリに保存されます。
	* `encrypted.mp4`  
		EME のみを使用する場合の暗号化した動画ファイルはこのファイル名で保存されます。
	* `intermediates`  
		変換スクリプトを実行途中に出力される中間生成ファイルが保存されるディレクトリです。  
		このディレクトリを消さずに残しておくと、次の変換操作の時にキャッシュとなって処理内容を減らせます。

## 設定の変え方

大まかな設定項目は全て `consts.ts` に集約しており、こちらを書き換えることで設定変更できるようになっています。以下に設定可能な項目を挙げています。

### 動画コンバーターの処理内容の指定 (`scripts/converter/main.ts`)

処理内容は予めテンプレートとして用意されている。 `main` 関数においてはそのうちのどのテンプレート処理を実行するかを選択できるようになっています。

```typescript
const main = async () => {
	// ここに選択したテンプレートの関数を記載します
	await create_demo_of_mse();
};
```

以下には用意されているテンプレートを表にまとめています。

| テンプレート名 | 内容 |
|:--:|:--|
| `create_demo_of_mse` | MSE API を使うストリーミング用の動画ファイルを作成します |
| `create_demo_of_mse_eme` | MSE API と EME API を使う暗号化したストリーミング用の動画ファイルを作成します |
| `create_demo_of_eme` | EME API を使う暗号化した動画ファイルを作成します |
| `create_demo_of_mse_dash` | MSE API を使うストリーミング用の動画ファイルを作成します。 Bento4 の DASH 形式で出力します。 |
| `create_demo_of_mse_eme_dash` | MSE API と EME API を使う暗号化したストリーミング用の動画ファイルを作成します。 Bento4 の DASH 形式で出力します。 |

`create_demo_of_mse`, `create_demo_of_mse_eme`, `create_demo_of_mse_dash`, `create_demo_of_mse_eme_dash` では引数を1つだけとっています。すでにフラグメント化などの処理を行っている場合は、 `true` に設定することで前の処理結果を流用でき、重たい FFmpeg を使った処理が行われずに、短時間で処理を終了させることができるようになります。

### 動画コンバーターの設定 (`scripts/converter/consts.ts`)

#### 解像度の定義

映像ファイルは複数の解像度に対して生成されます。生成する解像度を表す文字列を配列にして指定します。 `WxH` (真ん中はエックス) の形式で表します。

```typescript
export const resolutions = [
	"426x276", "640x416", "854x556", "1280x832", "1920x1248"
] as const;
```

#### ストリーミング固有の設定

以下はストリーミング用のコンテンツを生成するにあたって使用するパラメータになります。

* `segmentDuration` (`float`)  
	1つのセグメントあたりの再生秒数を指定します。つまりこの秒数ごとに区切ったセグメントが生成されます。
* `segmentCount` (`uint`)  
	ストリームあたり (1解像度の映像あるいは音声あたり) の全セグメントの個数を指定します。  
	全再生時間を `segmentDuration` で割った値を切り上げて整数にした値を設定してください。

#### 暗号化の設定

暗号化する時に使用する鍵を映像と音声のそれぞれで指定します。

```typescript
export const encryptionKeys: EncryptionKeys = {
	video: {
		keyId: "",
		key: ""
	},
	audio: {
		keyId: "",
		key: ""
	}
};
```

#### 動画ファイルのパスに関する設定

動画ファイルのパスを指定する設定項目があります。

* `originalPath`  
	変換元となる動画ファイルのパスを指定します。
* `intermediateDirPath`  
	処理の中間生成物が格納されるディレクトリのパスを指定します。
* `segmentsDirPath`  
	MSE 向けにセグメント分割した動画ファイルが格納されるディレクトリのパスを指定します。  
	テンプレート `create_demo_of_mse` で処理を行った場合の保存先です。
* `encryptedSegmentsDirPath`  
	MSE+EME 向けに暗号化しセグメント分割した動画ファイルが格納されるディレクトリのパスを指定します。  
	テンプレート `create_demo_of_mse_eme` で処理を行った場合の保存先です。
* `encryptedMediaPath`  
	EME 向けに暗号化した動画ファイルが保存されるパスを指定します。  
	テンプレート `create_demo_of_eme` で処理を行った場合の保存先です。
* `segmentsDashDirPath`  
	MSE 向けにセグメント分割した動画ファイルが格納されるディレクトリのパスを指定します。  
	DASH の形式で出力されます。  
	テンプレート `create_demo_of_mse_dash` で処理を行った場合の保存先です。
* `encryptedSegmentsDashDirPath`  
	MSE+EME 向けに暗号化しセグメント分割した動画ファイルが格納されるディレクトリのパスを指定します。  
	DASH の形式で出力されます。  
	テンプレート `create_demo_of_mse_eme_dash` で処理を行った場合の保存先です。

注意: 上記のパスの設定を変えますと、フロントエンド側で指定されるパスだけでなく、サーバ側スクリプトのフィルタリング設定も変える必要があります。

#### シェルコマンドの実行に関する設定

コマンドの実行に関して幾つかブール値による設定項目があります。

* `dryRun`  
	実際に処理内容を実行する代わりに、処理内容の表示だけを行うモードを有効にします。
* `showCommands`  
	`dryRun` とは違って実際に実行されます。その上で処理内容の表示も行うモードを有効にします。

### フロントエンド実装の設定 (`ts_src/consts.ts`)

#### 機能の有効化/無効化

各種機能を有効/無効にするフラグ変数 (`boolean`) が用意されています。デフォルトでは `false` に設定されており使用できませんが、 `true` に設定すると有効化されます。

| 変数 | 説明 |
|:--|:--|
| `enableMSE` | MSE API を使った機能の有効/無効を切り替える |
| `enableEME` | EME API を使った機能の有効/無効を切り替える |
| `enableAutoResolution` | `enableMSE` が `true` の時に、解像度選択の自動設定の有効/無効を切り替える |

但しそれぞれの変数は、以下の設定項目を書き換えないと有効化しても正常に作動しないようになっています。忘れずに設定してください。

#### パラメータを設定する関数

##### `getVideoSegmentUrl`, `getAudioSegmentUrl`

MSE API を使った再生において、映像と音声のそれぞれについてセグメントのパスを返す関数を用意します。 `enableMSE` を `true` に設定する時には必ずこちらを適切に設定してください。

必要としている解像度 (映像のみ) とセグメント番号の値から、対応するパスを指定するようにします。

解像度は後述のインデクス番号の整数により与えられます。

セグメント番号は、 `-1` であれば初期セグメント (`init.mp4`) 、 0 以上の値であれば通常のセグメントを返すようにします。

```typescript
// 映像のセグメントパス
export const getVideoSegmentUrl = (
	resIndex: ResIndex,  // 解像度番号
	segmentIndex: number // セグメント番号
): string => {
	// TODO: 適切なパスを返す
	return "";
};

// 音声のセグメントパス
export const getAudioSegmentUrl = (
	segmentIndex: number // セグメント番号
): string => {
	// TODO: 適切なパスを返す
	return "";
};
```

##### `getOptimalResolution`

解像度として「自動」が選択された時に、現在の再生状況に応じて適切な解像度を返す関数を用意します。 `enableAutoResolution` を `true` に設定する時は必ずこちらを適切に設定してください。

引数として現在の再生状況を表すオブジェクト `playerState` を受け取り、その値に応じて最適な解像度を選択し、その番号を返すようにします。

`playerState` は以下のプロパティを持ちます。


| プロパティ | 説明 |
|:--|:--|
| `currentTime` | 現在の再生位置 (先頭からの秒数) |
| `lastLoadedSegmentIndex` | 最後に読み込みが完了したセグメントの番号 (0,1,2,...) |
| `nextLoadingSegmentIndex` | 次に読み込む予定のセグメントの番号 (0,1,2,...) |
| `isOffline` | オフラインと判定されているか否か (`true` / `false`) |

```typescript
export const getOptimalResolution = (
	playerState: PlayerState
): ResIndex => {
	return 1;
};
```

##### `encryptionKeys`

暗号化に使用された鍵を設定します。 `enableEME` を `true` に設定する時は必ずこちらを適切に設定してください。

映像と音声に分けて指定することが可能になっていますが、特に違いはありませんし、逆に設定しても正常に機能します。 Key ID に対応する適切な Key を設定しないと復号ができず、再生できません。

```typescript
export const encryptionKeys: EncryptionKeys = {
	video: {
		keyId: "",
		key: ""
	},
	audio: {
		keyId: "",
		key: ""
	}
};
```

ここで `keyId` や `key` として設定可能な値は32桁の16進数です。これは以下のコマンドにより簡単に生成することができます。

```shell
openssl rand -hex 16
```

#### 解像度の定義

動画コンバーターで作成する時に設定した動画の解像度をここでも設定することで、作成した解像度の動画が再生できるようになります。

`resolution` 変数においては、解像度選択メニューで表示する形式で解像度を表す文字列をリスト形式で指定します。値に重複があってはなりません。

```typescript
export const resolutions = [
	"426x276", "640x416", "854x556", "1280x832", "1920x1248"
] as const;
```

`resolutionIndexes` においては、 `resolution` で用意したそれぞれの解像度に対してインデクス番号を割り振ります。他の関数ではこの番号を使って解像度を指定することになります。

```typescript
export const resolutionIndexes = {
	"426x276":   1,
	"640x416":   2,
	"854x556":   3,
	"1280x832":  4,
	"1920x1248": 5,
} as const;
```

#### ストリーミング固有の設定

以下はストリーミングにあたって使用するパラメータになります。適切な値を設定しないとプレーヤーが正しく機能しなくなります。

* `segmentDuration` (`float`)  
	1つのセグメントあたりの再生秒数を指定します。  
	コンバート時に設定した値を使用してください。
* `segmentCount` (`uint`)  
	ストリームあたり (1解像度の映像あるいは音声あたり) の全セグメントの個数を指定します。  
	全再生時間を `segmentDuration` で割った値を切り上げて整数にした値を設定してください。
* `maxBufferDuration` (`float`)  
	バッファをとる最大秒数を指定します。ネットワーク環境が良好であってもこれより長い秒数でバッファを用意することはありません。
* `advanceSegmentsAfterSeekEnd` (`uint`)  
	シーク後のセグメント読み込みで予め読み込んでおくセグメントの数を指定します。  
	少なすぎると再生してもすぐバッファ不足になり再生が止まってしまいます。
* `advanceSegmentsAfterWaiting` (`uint`)  
	バッファ不足で再生が止まるとバッファ取得を試みますが、そのバッファ取得に成功した後に予め読み込んでおくセグメントの数を指定します。  
	少なすぎるとまたすぐにバッファ不足になり再生が止まってしまいます。

## ソースファイルの構成

### フロントエンド JavaScript コード (`ts_src`)

| ファイル | 説明 |
|:--|:--|
| `consts.ts` | 定数値の宣言と、条件に応じて値を返すだけの関数の実装 |
| `core.ts` | JavaScript による処理のエントリポイント |
| `mse.ts` | MSE API を使った処理が用意されている |
| `mse_utils.ts` | `mse.ts` で使用するユーティリティ関数や型を用意する |
| `eme.ts` | EME API を使った処理が用意されている |
| `eme_utils.ts` | `eme.ts` で使用するユーティリティ関数や型を用意する |
| `interface.ts` | 表示する UI 機能を実装する |
| `interface_utils.ts` | `interface.ts` で使用するユーティリティ関数を用意する |
| `log.ts` | カスタマイズしたログ出力を行う関数を用意する |
| `utils.ts` | 全体で共通して利用するユーティリティを用意する |
| `misc.ts` | その他分類しづらい細々とした処理を用意する |

### フロントエンドリソース (`resources`)

| ファイル | 説明 |
|:--|:--|
| `style.css` | スタイルシートのエントリポイント (他の `css` ファイルを読み込む専用) |
| `base-layout.css` | 基本となるレイアウトを構成する |
| `conditional-layout.css` | 設定に応じて変化するレイアウトを用意する |
| `colors.css` | 色指定を行う |
| `icon.png` | ファビコン画像 |

### 動画変換ツール (`scripts/converter`)

| ファイル | 説明 |
|:--|:--|
| `consts.ts` | 定数値の宣言を行う |
| `main.ts` | 処理のエントリポイントが配置されている |
| `actions.ts` | 1つ1つの処理の内容が関数として実装されている |
| `template.ts` | 処理内容のテンプレートを実装する |
| `template_dash.ts` | DASH 形式で出力する処理内容のテンプレートを実装する |
| `utils.ts` | ユーティリティ関数を用意する |

## メモ

* MSE API を利用せず EME API のみを利用するケースは正しく動作しないはず。
	* 少なくとも Firefox ではコンソール中に MSE API を使わないで EME API を使用することはできない、と表示されるので全く使えない
* Visual Studio Code で作業する場合、 `scripts` ディレクトリ内の TypeScript ファイルの一部において、 Node.js 標準モジュールの `import` 文にエラーが表示されることがあります。解決策が判明しておらず、解決できていない。このエラーが発生している場合は、 `scripts` 内にある他のツールを構成する TypeScript ファイルを開くことで解決する場合がある。

## 参考にした実装

ここに用意しているコードは主に以下のリポジトリを参考に作られました。

* `media-player-demo-2024`  
	URL: https://github.com/access-company/media-player-demo-2024

* `mse-eme`  
	URL: https://github.com/cpearce/mse-eme
