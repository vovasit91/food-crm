import { sqliteTable, AnySQLiteColumn, integer, text, primaryKey, real } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const schemaVersion = sqliteTable("schema_version", {
	version: integer().notNull(),
	appliedAt: integer("applied_at").notNull(),
});

export const contentVersion = sqliteTable("content_version", {
	version: integer().notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const categories = sqliteTable("categories", {
	id: text().primaryKey().notNull(),
	enabled: integer().default(1).notNull(),
	icon: text().notNull(),
});

export const tagCategory = sqliteTable("tag_category", {
	tagId: text("tag_id").notNull(),
	categoryId: text("category_id").notNull(),
},
(table) => [
	primaryKey({ columns: [table.tagId, table.categoryId], name: "tag_category_tag_id_category_id_pk"})
]);

export const tagKitchenItem = sqliteTable("tag_kitchen_item", {
	tagId: text("tag_id").notNull(),
	kitchenItemId: text("kitchen_item_id").notNull(),
},
(table) => [
	primaryKey({ columns: [table.tagId, table.kitchenItemId], name: "tag_kitchen_item_tag_id_kitchen_item_id_pk"})
]);

export const ingredients = sqliteTable("ingredients", {
	id: text().primaryKey().notNull(),
	category: text().notNull(),
	icon: text().notNull(),
	proteins: integer(),
	carbs: integer(),
	fats: integer(),
	gInMeasurement: real("g_in_measurement"),
	measurement: text().notNull(),
	mlInMeasurement: real("ml_in_measurement"),
	isBasic: integer("is_basic"),
	allergy: text(),
});

export const kitchenItems = sqliteTable("kitchen_items", {
	id: text().primaryKey().notNull(),
	icon: text().notNull(),
});

export const recipes = sqliteTable("recipes", {
	id: text().primaryKey().notNull(),
	image: text().notNull(),
	timeMinutes: integer("time_minutes").notNull(),
	difficulty: text().notNull(),
	isEnabled: integer("is_enabled").default(1).notNull(),
	basePortions: integer("base_portions").default(1).notNull(),
	portionType: text("portion_type").default("portion").notNull(),
	isBatch: integer("is_batch").default(0).notNull(),
});

export const recipeTag = sqliteTable("recipe_tag", {
	recipeId: text("recipe_id").notNull(),
	tagId: text("tag_id").notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.tagId], name: "recipe_tag_recipe_id_tag_id_pk"})
]);

export const recipeKitchenItem = sqliteTable("recipe_kitchen_item", {
	recipeId: text("recipe_id").notNull(),
	kitchenItemId: text("kitchen_item_id").notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.kitchenItemId], name: "recipe_kitchen_item_recipe_id_kitchen_item_id_pk"})
]);

export const recipeVariation = sqliteTable("recipe_variation", {
	recipeId: text("recipe_id").notNull(),
	variationRecipeId: text("variation_recipe_id").notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.variationRecipeId], name: "recipe_variation_recipe_id_variation_recipe_id_pk"})
]);

export const recipeTldrStep = sqliteTable("recipe_tldr_step", {
	recipeId: text("recipe_id").notNull(),
	stepId: text("step_id").notNull(),
	sortOrder: integer("sort_order").notNull(),
	minutes: integer().notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.sortOrder], name: "recipe_tldr_step_recipe_id_sort_order_pk"})
]);

export const recipeIngredient = sqliteTable("recipe_ingredient", {
	recipeId: text("recipe_id").notNull(),
	ingredientId: text("ingredient_id").notNull(),
	sortOrder: integer("sort_order").notNull(),
	quantity: real(),
	unit: text(),
	optional: integer().default(0).notNull(),
	portionCoefficient: integer("portion_coefficient").default(1).notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.ingredientId], name: "recipe_ingredient_recipe_id_ingredient_id_pk"})
]);

export const recipeIngredientSubstitutes = sqliteTable("recipe_ingredient_substitutes", {
	recipeId: text("recipe_id").notNull(),
	ingredientId: text("ingredient_id").notNull(),
	substituteIngredientId: text("substitute_ingredient_id").notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.ingredientId, table.substituteIngredientId], name: "recipe_ingredient_substitutes_recipe_id_ingredient_id_substitute_ingredient_id_pk"})
]);

export const recipeCookingStep = sqliteTable("recipe_cooking_step", {
	recipeId: text("recipe_id").notNull(),
	step: text().notNull(),
	sortOrder: integer("sort_order").notNull(),
	duration: integer().default(0).notNull(),
	showTimer: integer("show_timer").default(0).notNull(),
	image: text(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.sortOrder], name: "recipe_cooking_step_recipe_id_sort_order_pk"})
]);

export const cookingStepTag = sqliteTable("cooking_step_tag", {
	recipeId: text("recipe_id").notNull(),
	step: text().notNull(),
	tag: text().notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.step, table.tag], name: "cooking_step_tag_recipe_id_step_tag_pk"})
]);

export const translations = sqliteTable("translations", {
	locale: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id").notNull(),
	value: text().notNull(),
},
(table) => [
	primaryKey({ columns: [table.locale, table.entityType, table.entityId], name: "translations_locale_entity_type_entity_id_pk"})
]);

export const cookingStepIngredient = sqliteTable("cooking_step_ingredient", {
	recipeId: text("recipe_id").notNull(),
	step: text().notNull(),
	ingredientId: text("ingredient_id").notNull(),
	quantity: real(),
	unit: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.step, table.ingredientId], name: "cooking_step_ingredient_recipe_id_step_ingredient_id_pk"})
]);

export const tags = sqliteTable("tags", {
	id: text().primaryKey().notNull(),
	label: text().notNull(),
	icon: text(),
	type: text().default("recipe").notNull(),
	isEnabled: integer("is_enabled").default(1).notNull(),
});

export const cookingStepKitchenItem = sqliteTable("cooking_step_kitchen_item", {
	recipeId: text("recipe_id").notNull(),
	step: text().notNull(),
	kitchenItemId: text("kitchen_item_id").notNull(),
},
(table) => [
	primaryKey({ columns: [table.recipeId, table.step, table.kitchenItemId], name: "cooking_step_kitchen_item_recipe_id_step_kitchen_item_id_pk"})
]);

