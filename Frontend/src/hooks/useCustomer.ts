/**
 * useCustomer
 *
 * Central customer hook for time reporting.
 * - Loads all customers, owner companies and recent customers on mount
 * - Provides search against the customer API
 * - Supports quick-adding new end customers under an owner
 */


import { useCallback, useEffect, useState } from "react";
import type { icustomer } from "../models/icustomer";
import { TimeReportService } from "../services/timeReportService";

export const useCustomer = () => {
  const [customer, setCustomer] = useState<icustomer[]>([]);
  const [ownerCompanies, setOwnerCompanies] = useState<icustomer[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<icustomer[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [cust, owners, recent] = await Promise.all([
          TimeReportService.getAllCustomers(),
          TimeReportService.getOwnerCompanies(),
          TimeReportService.getRecentCustomers(),
        ]);

        if (cancelled) return;
        setCustomer(cust ?? []);
        setOwnerCompanies(owners ?? []);
        setRecentCustomers(recent ?? []);
      } catch (e) {
        if (!cancelled) {
          console.error("Error loading initial customer data:", e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshRecent = useCallback(async () => {
    try {
      const response = await TimeReportService.getRecentCustomers();
      setRecentCustomers(response);
    } catch (error) {
      console.error("Error fetching recent customers:", error);
    }
  }, []);

  const searchCustomerfromapi = useCallback(
    async (query: string) => {
      return TimeReportService.searchCustomer(query);
    },
    []
  );

  const quickAdd = useCallback(
    async (company: string, ownerId: number) => {
      try {
        const newCustomer = await TimeReportService.quickAddCustomer(
          company,
          ownerId
        );
        setCustomer((prev) => [...prev, newCustomer]);
        setRecentCustomers((prev) => [newCustomer, ...prev].slice(0, 5));
        return newCustomer;
      } catch (error) {
        console.error("Error adding customer:", error);
        throw error;
      }
    },
    []
  );

  return {
    customer,
    searchCustomerfromapi,
    ownerCompanies,
    quickAdd,
    recentCustomers,
    refreshRecent,
  };
};
