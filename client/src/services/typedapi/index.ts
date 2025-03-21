import { type Route, type GetRoute, type PostRoute, type PatchRoute, type DeleteRoute, type PutRoute } from "@solaris-common";
import { type Axios, type AxiosRequestConfig, isAxiosError } from "axios";
import type { InjectionKey } from "vue";

export type ReqOptions = AxiosRequestConfig;

export enum ResponseResultKind {
  Ok = 'ok',
  RequestError = 'requestError',
  ResponseError = 'responseError',
};

export type ResponseResultOk<T> = {
  kind: ResponseResultKind.Ok,
  data: T,
};

export type ResponseResultRequestError = {
  kind: ResponseResultKind.RequestError,
  cause: Error,
}

export type ResponseResultResponseError = {
  kind: ResponseResultKind.ResponseError,
  status: number,
  data: string,
  cause: Error,
};

export type ResponseResult<T> = ResponseResultOk<T> | ResponseResultRequestError | ResponseResultResponseError;

export const isError = <T>(result: ResponseResult<T>) => result.kind !== ResponseResultKind.Ok;

const PATH_VARIABLE_PATTERN = /:(.\w+)/g;

const BASE_URL = import.meta.env.VUE_APP_API_HOST;

const pathReplacement = <PP extends Object, T1, T2>(route: Route<PP, T1, T2>, params: PP) => {
  const relPath = route.path.replaceAll(PATH_VARIABLE_PATTERN, (_match, g1) => {
    const param = params[g1];

    if (param === undefined) {
      throw new Error(`Call to ${route.path} is missing value for parameter ${g1}`);
    }

    return param;
  });

  return BASE_URL + relPath;
}

const mapError = <T>(e: unknown, path: string): ResponseResult<T> => {
  if (isAxiosError(e)) {
    if (e.response) {
      return {
        kind: ResponseResultKind.ResponseError,
        status: e.response.status,
        data: e.response.data,
        cause: e,
      }
    } else {
      return {
        kind: ResponseResultKind.RequestError,
        cause: e,
      }
    }
  } else {
    throw new Error(`Error calling ${path}`, { cause: e });
  }
}

export const doGet = (axios: Axios) => async <PathParams extends Object, Resp>(route: GetRoute<PathParams, Resp>, args: PathParams, options?: ReqOptions): Promise<ResponseResult<Resp>> => {
  const path = pathReplacement(route, args);

  try {
    const response = await axios.get<Resp>(path, options);

    return {
      kind: ResponseResultKind.Ok,
      data: response.data,
    }
  } catch (e) {
    return mapError(e, path);
  }
}


export const doPost = (axios: Axios) => async <PathParams extends Object, Req, Resp>(route: PostRoute<PathParams, Req, Resp>, args: PathParams, req: Req, options?: ReqOptions): Promise<ResponseResult<Resp>> => {
  const path = pathReplacement(route, args);

  try {
    const response = await axios.post<Resp>(path, req, options);

    return {
      kind: ResponseResultKind.Ok,
      data: response.data,
    }
  } catch (e) {
    return mapError(e, path);
  }
}

export const doPatch = (axios: Axios) => async <PathParams extends Object, Req, Resp>(route: PatchRoute<PathParams, Req, Resp>, args: PathParams, req: Req, options?: ReqOptions): Promise<ResponseResult<Resp>> => {
  const path = pathReplacement(route, args);

  try {
    const response = await axios.patch<Resp>(path, req, options);

    return {
      kind: ResponseResultKind.Ok,
      data: response.data,
    }
  } catch (e) {
    return mapError(e, path);
  }
}

export const doDelete = (axios: Axios) => async <PathParams extends Object, Req, Resp>(route: DeleteRoute<PathParams, Resp>, args: PathParams, req: Req, options?: ReqOptions): Promise<ResponseResult<Resp>> => {
  const path = pathReplacement(route, args);

  try {
    const response = await axios.delete<Resp>(path, options);

    return {
      kind: ResponseResultKind.Ok,
      data: response.data,
    }
  } catch (e) {
    return mapError(e, path);
  }
}

export const doPut = (axios: Axios) => async <PathParams extends Object, Req, Resp>(route: PutRoute<PathParams, Req, Resp>, args: PathParams, req: Req, options?: ReqOptions): Promise<ResponseResult<Resp>> => {
  const path = pathReplacement(route, args);

  try {
    const response = await axios.put<Resp>(path, req, options);

    return {
      kind: ResponseResultKind.Ok,
      data: response.data,
    }
  } catch (e) {
    return mapError(e, path);
  }
}

export const httpInjectionKey: InjectionKey<Axios> = Symbol('httpClient');
