"use client";
/**
 * Pont react-router-dom → next/navigation pour les écrans sociaux repris de BeeMarketing.
 * Couvre seulement l'usage des écrans portés : useSearchParams (lecture + mise à jour, `replace`),
 * useNavigate (chemin) et Link (`to`). Les URL restent celles de BeeMarketing (`/publication?…`).
 */
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { useCallback, useMemo, type ComponentProps } from "react";

type ParamsInit = URLSearchParams | string | Record<string, string>;
type SetParams = (next: ParamsInit | ((previous: URLSearchParams) => ParamsInit), options?: { replace?: boolean }) => void;

export function useSearchParams(): [URLSearchParams, SetParams] {
  const current = useNextSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const params = useMemo(() => new URLSearchParams(current?.toString() ?? ""), [current]);
  const setParams = useCallback<SetParams>((next, options) => {
    const value = typeof next === "function" ? next(new URLSearchParams(params)) : next;
    const query = new URLSearchParams(value).toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (options?.replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [params, pathname, router]);
  return [params, setParams];
}

export function useNavigate(): (to: string, options?: { replace?: boolean }) => void {
  const router = useRouter();
  return useCallback((to: string, options?: { replace?: boolean }) => {
    if (options?.replace) router.replace(to);
    else router.push(to);
  }, [router]);
}

export function Link({ to, ...rest }: Omit<ComponentProps<typeof NextLink>, "href"> & { to: string }) {
  return <NextLink href={to} {...rest} />;
}
