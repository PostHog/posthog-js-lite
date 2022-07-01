export type PostHogCoreFetchRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  url: string;
  data: any;
  headers: {
    [key: string]: string;
  };
  timeout?: number;
};

export type PostHogCoreFetchResponse = {
  status: number;
  data: any;
};
