/**
 * useTimeOverviewData
 *
 * Lookup-data orchestrator used by the Time Overview UI.
 *
 * Responsibilities:
 * - Loads reference data needed by the overview page + edit dialogs:
 *   - categories
 *   - owner companies
 *   - recent customers
 *   - optionally: full customers list (for "All customers" UI)
 * - Provides customer actions:
 *   - searchCustomers(q)
 *   - quickAdd(company, ownerId)
 *   - touchUsage(customerId) (usage tracking / recents)
 * - Provides project loading with a per-customer cache:
 *   - loadProjectsForCustomer(customerId)
 * - Provides article search:
 *   - articleSearch.run(q, limit, offset)
 *
 * This hook is intentionally UI-centric:
 * it returns the exact shapes expected by components:
 * - customerData
 * - lookupData
 * - articleSearch
 */


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../models/project";
import type { Customer } from "../models/customer";
import type { Category, Article } from "../models/Article";
import { TimeReportService } from "../services/timeReportService";


export type CustomerData = {
  customers: Customer[];
  ownerCompanies: Customer[];
  recentCustomers: Customer[];
  searchCustomers: (q: string) => Promise<Customer[]>;
  quickAdd: (company: string, ownerId: number) => Promise<Customer>;
  touchUsage?: (customerId: number) => Promise<void>;
};

export type LookupData = {
  categories: Category[];
  loadProjectsForCustomer: (customerId: number) => Promise<Project[]>;
};

export type ArticleSearch = {
  run: (q: string, limit?: number, offset?: number) => Promise<Article[]>;
};

export function useTimeOverviewData() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ownerCompanies, setOwnerCompanies] = useState<Customer[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const projectsCacheRef = useRef<Map<number, Project[]>>(new Map());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [cats, owners, recents] = await Promise.all([
          TimeReportService.getCategories(),
          TimeReportService.getOwnerCompanies().catch(() => [] as Customer[]),
          TimeReportService.getRecentCustomers().catch(() => [] as Customer[]),
        ]);

        if (cancelled) return;

        setCategories(Array.isArray(cats) ? cats : []);
        setOwnerCompanies(Array.isArray(owners) ? owners : []);
        setRecentCustomers(Array.isArray(recents) ? recents : []);
      } catch {
      }

      try {
        const all = await TimeReportService.getAllCustomers();
        if (!cancelled) setCustomers(Array.isArray(all) ? all : []);
      } catch {
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const searchCustomers = useCallback(async (q: string) => {
    const query = (q ?? "").trim();
    if (!query) return [];

    const res = await TimeReportService.searchCustomer(query);
    return Array.isArray(res) ? res : [];
  }, []);

  const quickAdd = useCallback(async (company: string, ownerId: number) => {
    return TimeReportService.quickAddCustomer(company, ownerId);
  }, []);

  const touchUsage = useCallback(async (customerId: number) => {
    await TimeReportService.touchCustomerUsage(customerId);
  }, []);

  const loadProjectsForCustomer = useCallback(async (customerId: number) => {
    if (!Number.isFinite(customerId)) return [];

    const cached = projectsCacheRef.current.get(customerId);
    if (cached) return cached;

    const rows = await TimeReportService.getProjectsByCustomerId(customerId);
    const list = Array.isArray(rows) ? rows : [];
    projectsCacheRef.current.set(customerId, list);
    return list;
  }, []);

  const runArticleSearch = useCallback(async (q: string, limit = 10, offset = 0) => {
    const query = (q ?? "").trim();
    if (!query) return [];
    return TimeReportService.searchArticles(query, limit, offset);
  }, []);

  const customerData: CustomerData = useMemo(
    () => ({
      customers,
      ownerCompanies,
      recentCustomers,
      searchCustomers,
      quickAdd,
      touchUsage,
    }),
    [customers, ownerCompanies, recentCustomers, searchCustomers, quickAdd, touchUsage]
  );

  const lookupData: LookupData = useMemo(
    () => ({
      categories,
      loadProjectsForCustomer,
    }),
    [categories, loadProjectsForCustomer]
  );

  const articleSearch: ArticleSearch = useMemo(
    () => ({
      run: runArticleSearch,
    }),
    [runArticleSearch]
  );

  return { customerData, lookupData, articleSearch };
}
