export interface IRecord {
  url: string;
  content: string;
  encoding: string;
}

export interface IInvertedIndex {
  [key: string]: {
    importance: number;
    postings: IPosting[];
  };
}

export interface IPosting {
  docId: string;
  tfIdf: number;
}
