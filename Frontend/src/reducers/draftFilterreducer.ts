import type { DraftFilters, OrderKey, SortKey } from "../models/Draft";




export const DEFAULT_FILTERS: DraftFilters = {
 q: "",
 from: undefined,          
 to: undefined,           
 sort: "company_name",
 order: "asc",
 limit: 50,
 offset: 0,
};

export const DEFAULT_ORDER_FOR_SORT: Record<SortKey, OrderKey> = {
 company_name: "asc",
 modified: "desc",
 date: "desc",
 created_date: "desc",
};


type Action =
  | { type: 'SET_SORT'; sort: SortKey }
  | { type: 'SET_ORDER'; order: OrderKey }
  | { type: 'PATCH'; patch: Partial<DraftFilters> }
  | { type: 'RESET' };

export const filtersReducer = (state: DraftFilters, action: Action): DraftFilters => {
  switch (action.type) {
    case 'SET_SORT': {
      return { ...state, sort: action.sort };
    }
    case 'SET_ORDER':
      return { ...state, order: action.order };
    case 'PATCH':
      return { ...state, ...action.patch };
    case 'RESET':
      return DEFAULT_FILTERS;
    default:
      return state;
  }
}


