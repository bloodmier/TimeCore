/**
 * useCategory
 *
 * Loads and exposes all time report categories from the backend.
 * Used to populate the category select when registering time.
 */

import { useEffect, useState } from "react";
import type { Category } from "../models/Article";
import { TimeReportService } from "../services/timeReportService";

export const useCategory = () => {
  const [category, setCategory] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const response = await TimeReportService.getCategories();
        setCategory(response);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    if (category.length === 0) {
      void fetchCategory();
    }
  }, [category.length]);

  return { category };
};
