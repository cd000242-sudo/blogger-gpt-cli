export interface CollectedImage {
    url: string;
    title: string;
    source: 'naver-image' | 'naver-shopping' | 'shopping-crawl' | 'coupang' | 'gmarket' | '11st';
    keyword: string;
    localPath?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    relevanceScore?: number | undefined;
}
export interface ImageCollectionResult {
    ok: boolean;
    images: CollectedImage[];
    folderPath: string;
    error?: string;
}
export interface SubtopicImageMatch {
    subtopic: string;
    images: CollectedImage[];
    selectedImage?: CollectedImage | undefined;
}
export declare function searchNaverImages(keyword: string, clientId: string, clientSecret: string, options?: {
    display?: number;
    filter?: 'all' | 'large' | 'medium' | 'small';
    sort?: 'sim' | 'date';
}): Promise<CollectedImage[]>;
export declare function searchNaverShopping(keyword: string, clientId: string, clientSecret: string, options?: {
    display?: number;
    sort?: 'sim' | 'date' | 'asc' | 'dsc';
}): Promise<CollectedImage[]>;
export declare function crawlShoppingUrl(url: string): Promise<CollectedImage[]>;
export declare function matchImagesToSubtopics(subtopics: string[], images: CollectedImage[]): SubtopicImageMatch[];
export declare function collectImagesByTitle(title: string, subtopics: string[], naverClientId: string, naverClientSecret: string, options?: {
    saveToFolder?: boolean;
    maxImagesPerSubtopic?: number;
    includeShoppingImages?: boolean;
}): Promise<ImageCollectionResult>;
export declare function collectImagesFromShoppingUrl(shoppingUrl: string, subtopics: string[], options?: {
    saveToFolder?: boolean;
    maxImages?: number;
}): Promise<ImageCollectionResult>;
export declare function getImageFolders(): {
    name: string;
    path: string;
    imageCount: number;
}[];
export declare function getImagesFromFolder(folderPath: string): {
    path: string;
    name: string;
}[];
export declare function deleteImageFolder(folderPath: string): boolean;
//# sourceMappingURL=image-collector.d.ts.map