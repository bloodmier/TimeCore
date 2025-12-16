import { Router } from "express";
import {
  createTimeReport,
  getProjectsById,
  getAllCustomers,
  SearchCustomers,
  getCategories,
  getLaborTemplates,
  getOwnerCompanies,
  quickAddCustomer,
  getRecentCustomers,
  touchCustomerUsage,
  saveDraft,
  getDrafts,
  deleteDraft,
  clearDrafts,
  getDraftsById,
  saveTimeTemplate,
  getAllsavedTemplates,
  getsavedTemplatesById,
  deletesavedTemplatesById,
  getArticles,
  addOrReplaceItems,
  getItemsForReport,
  getDraftItems,
  updateDraft,
  postLaborTemplates,
  deleteLaborTemplates,
} from "../controller/timereportController.js";



const r = Router();

/**
 * Search customers by name (query param ?q=).
 */
r.get("/searchcustomers", SearchCustomers);

/**
 * Get all customers.
 */
r.get("/getallcustomers", getAllCustomers);

/**
 * Get time report categories (types of work).
 */
r.get("/getCategories", getCategories);

/**
 * Get predefined labor text templates.
 */
r.get("/labor-templates", getLaborTemplates);
/**
 * crate labor text templates.
 */
r.post("/labor-templates", postLaborTemplates);
/**
 * delete labor text templates.
 */
r.delete("/labor-templates/:id", deleteLaborTemplates);

/**
 * Get all projects for a specific customer (by customerId in body).
 */
r.post("/getregisterdtime", getProjectsById);

/**
 * Create one or multiple time reports (optionally with items).
 */
r.post("/addtime", createTimeReport);

/**
 * Get all “owner” customers (billing_owner = 1).
 */
r.get("/customer/owners", getOwnerCompanies);

/**
 * Quickly create a new end-customer attached to an owner.
 */
r.post("/customer/quick-add", quickAddCustomer);

/**
 * Get recently used customers for the current user.
 */
r.get("/customer/recent", getRecentCustomers);

/**
 * Update “last_used” tracking for a customer + user combination.
 */
r.post("/customer/touch", touchCustomerUsage);

/**
 * Update an existing time report draft (header + items).
 */
r.put("/draft/update/:id", updateDraft);

/**
 * Save a new time report draft (header + items).
 */
r.post("/draft/save", saveDraft);

/**
 * Get all drafts for the current user (with filters).
 */
r.get("/drafts", getDrafts);

/**
 * Get a single draft by id (with items).
 */
r.get("/drafts/:id", getDraftsById);

/**
 * Delete a single draft (and its items).
 */
r.post("/draft/delete", deleteDraft);

/**
 * Clear all drafts for the current user.
 */
r.post("/drafts/clear", clearDrafts);

/**
 * Get only the items for a specific draft id.
 */
r.get("/drafts/:id/items", getDraftItems);

/**
 * Save a time report template (reusable draft).
 */
r.post("/template/save", saveTimeTemplate);

/**
 * Get all time report templates for the current user.
 */
r.get("/template/all", getAllsavedTemplates);

/**
 * Get a single saved template by id.
 */
r.get("/template/:id", getsavedTemplatesById);

/**
 * Delete a saved template by id.
 */
r.delete("/template/:id", deletesavedTemplatesById);

/**
 * Search / list articles (materials/products).
 */
r.get("/articles", getArticles);

/**
 * Replace all items for a given time_report (by id).
 */
r.put("/:id/items", addOrReplaceItems);

/**
 * Get all items for a given time_report (by id).
 */
r.get("/:id/items", getItemsForReport);



export default r;
