// Reviewed Phase 3 floor metadata. IDs/finish slugs are immutable; labels are mutable.
// No image imports, prices or atlas-order-derived identities belong in this module.
export type PixelPoint = readonly [number, number];
export interface ArtworkEnvelope {
  readonly left: number; readonly top: number; readonly right: number; readonly bottom: number;
}
export interface FloorPlacementContract {
  readonly surface: 'floor';
  readonly nativeScale: 1;
  // Rectangle of cells [gridU-footprintU, gridU) × [gridV-footprintV, gridV).
  readonly footprintU: number; readonly footprintV: number;
  readonly anchorRule: 'front-base'; readonly anchorNote: string;
  // Combined crop bounds relative to the logical base, NOT collision occupancy.
  readonly artworkEnvelope: ArtworkEnvelope;
}
export interface FloorVariantDefinition {
  readonly id: string; readonly label: string;
  readonly width: number; readonly height: number; readonly anchor: PixelPoint;
}
export interface FloorDecorationDefinition {
  readonly id: string; readonly displayName: string; readonly category: string;
  readonly defaultVariantId: string;
  readonly variants: readonly FloorVariantDefinition[];
  readonly floor: FloorPlacementContract;
}

export const floorDecorations = [
  {
    id: 'decor_yarn_ball', displayName: 'Yarn Ball', category: 'Toys',
    defaultVariantId: 'decor_yarn_ball_sage',
    variants: [
      { id: 'decor_yarn_ball_sage', label: 'Sage', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_slate', label: 'Slate', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_sky_blue', label: 'Sky Blue', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_cream', label: 'Cream', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_red', label: 'Red', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_grey', label: 'Grey', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_teal', label: 'Teal', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_indigo', label: 'Indigo', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_plum', label: 'Plum', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_olive', label: 'Olive', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_gold', label: 'Gold', width: 22, height: 20, anchor: [11, 19] },
      { id: 'decor_yarn_ball_purple', label: 'Purple', width: 22, height: 20, anchor: [11, 19] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 1, footprintV: 1,
      anchorRule: 'front-base', anchorNote: 'Sphere floor contact',
      artworkEnvelope: {"left": -11, "top": -19, "right": 11, "bottom": 1} },
  },
  {
    id: 'decor_cat_tree_multilevel', displayName: 'Cat Tree', category: 'Cat Furniture',
    defaultVariantId: 'decor_cat_tree_multilevel_cream',
    variants: [
      { id: 'decor_cat_tree_multilevel_cream', label: 'Cream', width: 85, height: 175, anchor: [42, 172] },
      { id: 'decor_cat_tree_multilevel_aqua', label: 'Aqua', width: 85, height: 175, anchor: [42, 172] },
      { id: 'decor_cat_tree_multilevel_lavender', label: 'Lavender', width: 85, height: 175, anchor: [42, 172] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 3, footprintV: 3,
      anchorRule: 'front-base', anchorNote: 'Bottom platform base',
      artworkEnvelope: {"left": -42, "top": -172, "right": 43, "bottom": 3} },
  },
  {
    id: 'decor_cat_bed_cushioned', displayName: 'Cushioned Cat Bed', category: 'Cat Furniture',
    defaultVariantId: 'decor_cat_bed_cushioned_blue',
    variants: [
      { id: 'decor_cat_bed_cushioned_blue', label: 'Blue', width: 110, height: 82, anchor: [55, 80] },
      { id: 'decor_cat_bed_cushioned_grey', label: 'Grey', width: 110, height: 82, anchor: [55, 80] },
      { id: 'decor_cat_bed_cushioned_rose', label: 'Rose', width: 110, height: 82, anchor: [55, 80] },
      { id: 'decor_cat_bed_cushioned_olive', label: 'Olive', width: 110, height: 82, anchor: [55, 80] },
      { id: 'decor_cat_bed_cushioned_purple', label: 'Purple', width: 110, height: 82, anchor: [55, 80] },
      { id: 'decor_cat_bed_cushioned_teal', label: 'Teal', width: 110, height: 82, anchor: [55, 80] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 4, footprintV: 4,
      anchorRule: 'front-base', anchorNote: 'Front edge of bed base',
      artworkEnvelope: {"left": -55, "top": -80, "right": 55, "bottom": 2} },
  },
  {
    id: 'decor_plant_small_potted', displayName: 'Small Potted Plant', category: 'Plants',
    defaultVariantId: 'decor_plant_small_potted_rose',
    variants: [
      { id: 'decor_plant_small_potted_rose', label: 'Rose', width: 23, height: 29, anchor: [11, 27] },
      { id: 'decor_plant_small_potted_grey', label: 'Grey', width: 23, height: 29, anchor: [11, 27] },
      { id: 'decor_plant_small_potted_cream', label: 'Cream', width: 23, height: 29, anchor: [11, 27] },
      { id: 'decor_plant_small_potted_blue', label: 'Blue', width: 23, height: 29, anchor: [11, 27] },
      { id: 'decor_plant_small_potted_lime', label: 'Lime', width: 23, height: 29, anchor: [11, 27] },
      { id: 'decor_plant_small_potted_indigo', label: 'Indigo', width: 23, height: 29, anchor: [11, 27] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 1, footprintV: 1,
      anchorRule: 'front-base', anchorNote: 'Pot bottom, not foliage',
      artworkEnvelope: {"left": -11, "top": -27, "right": 12, "bottom": 2} },
  },
  {
    id: 'decor_cat_tower_stair', displayName: 'Cat Tower', category: 'Cat Furniture',
    defaultVariantId: 'decor_cat_tower_stair_honey',
    variants: [
      { id: 'decor_cat_tower_stair_honey', label: 'Honey', width: 111, height: 158, anchor: [66, 156] },
      { id: 'decor_cat_tower_stair_cream', label: 'Cream', width: 111, height: 158, anchor: [66, 156] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 5, footprintV: 3,
      anchorRule: 'front-base', anchorNote: 'Asymmetric front stair/base reference',
      artworkEnvelope: {"left": -66, "top": -156, "right": 45, "bottom": 2} },
  },
  {
    id: 'decor_bookshelf_open', displayName: 'Open Bookshelf', category: 'Furniture',
    defaultVariantId: 'decor_bookshelf_open_peach',
    variants: [
      { id: 'decor_bookshelf_open_peach', label: 'Peach', width: 100, height: 128, anchor: [50, 125] },
      { id: 'decor_bookshelf_open_blue', label: 'Blue', width: 100, height: 129, anchor: [50, 126] },
      { id: 'decor_bookshelf_open_sage', label: 'Sage', width: 100, height: 128, anchor: [50, 125] },
      { id: 'decor_bookshelf_open_purple', label: 'Purple', width: 100, height: 127, anchor: [50, 124] },
      { id: 'decor_bookshelf_open_sand', label: 'Sand', width: 100, height: 127, anchor: [50, 124] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 4, footprintV: 4,
      anchorRule: 'front-base', anchorNote: 'Multi-foot base; shelf masks retained',
      artworkEnvelope: {"left": -50, "top": -126, "right": 50, "bottom": 3} },
  },
  {
    id: 'decor_plant_large_potted', displayName: 'Large Potted Plant', category: 'Plants',
    defaultVariantId: 'decor_plant_large_potted_brown',
    variants: [
      { id: 'decor_plant_large_potted_brown', label: 'Brown', width: 45, height: 108, anchor: [22, 106] },
      { id: 'decor_plant_large_potted_navy', label: 'Navy', width: 45, height: 108, anchor: [22, 106] },
      { id: 'decor_plant_large_potted_plum', label: 'Plum', width: 45, height: 108, anchor: [22, 106] },
      { id: 'decor_plant_large_potted_blue', label: 'Blue', width: 45, height: 108, anchor: [22, 106] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 2, footprintV: 2,
      anchorRule: 'front-base', anchorNote: 'Pot bottom, not canopy',
      artworkEnvelope: {"left": -22, "top": -106, "right": 23, "bottom": 2} },
  },
  {
    id: 'decor_scratching_post_round', displayName: 'Scratching Post', category: 'Cat Furniture',
    defaultVariantId: 'decor_scratching_post_round_cream',
    variants: [
      { id: 'decor_scratching_post_round_cream', label: 'Cream', width: 55, height: 77, anchor: [27.5, 76] },
      { id: 'decor_scratching_post_round_brown', label: 'Brown', width: 55, height: 77, anchor: [27.5, 76] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 2, footprintV: 2,
      anchorRule: 'front-base', anchorNote: 'Front of round base',
      artworkEnvelope: {"left": -27.5, "top": -76, "right": 27.5, "bottom": 1} },
  },
  {
    id: 'decor_bowl', displayName: 'Cat Bowl', category: 'Feeding',
    defaultVariantId: 'decor_bowl_blue',
    variants: [
      { id: 'decor_bowl_blue', label: 'Blue', width: 43, height: 37, anchor: [21, 35] },
      { id: 'decor_bowl_sand', label: 'Sand', width: 43, height: 37, anchor: [21, 35] },
      { id: 'decor_bowl_purple', label: 'Purple', width: 43, height: 37, anchor: [21, 35] },
      { id: 'decor_bowl_white', label: 'White', width: 43, height: 37, anchor: [21, 35] },
      { id: 'decor_bowl_rose', label: 'Rose', width: 43, height: 37, anchor: [21, 35] },
      { id: 'decor_bowl_sage', label: 'Sage', width: 43, height: 37, anchor: [21, 35] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 2, footprintV: 2,
      anchorRule: 'front-base', anchorNote: 'Bowl bottom; kibble artwork only',
      artworkEnvelope: {"left": -21, "top": -35, "right": 22, "bottom": 2} },
  },
  {
    id: 'decor_cat_perch_double', displayName: 'Double Cat Perch', category: 'Cat Furniture',
    defaultVariantId: 'decor_cat_perch_double_cream',
    variants: [
      { id: 'decor_cat_perch_double_cream', label: 'Cream', width: 55, height: 92, anchor: [27, 90] },
      { id: 'decor_cat_perch_double_peach', label: 'Peach', width: 55, height: 92, anchor: [27, 90] },
      { id: 'decor_cat_perch_double_blue', label: 'Blue', width: 55, height: 92, anchor: [27, 90] },
      { id: 'decor_cat_perch_double_rose', label: 'Rose', width: 55, height: 92, anchor: [27, 90] },
      { id: 'decor_cat_perch_double_sage', label: 'Sage', width: 55, height: 92, anchor: [27, 90] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 2, footprintV: 2,
      anchorRule: 'front-base', anchorNote: 'Bottom circular platform base',
      artworkEnvelope: {"left": -27, "top": -90, "right": 28, "bottom": 2} },
  },
  {
    id: 'decor_table_low_square', displayName: 'Low Table', category: 'Furniture',
    defaultVariantId: 'decor_table_low_square_cream',
    variants: [
      { id: 'decor_table_low_square_cream', label: 'Cream', width: 61, height: 61, anchor: [30, 59] },
      { id: 'decor_table_low_square_grey', label: 'Grey', width: 61, height: 61, anchor: [30, 59] },
      { id: 'decor_table_low_square_rose', label: 'Rose', width: 61, height: 61, anchor: [30, 59] },
      { id: 'decor_table_low_square_blue', label: 'Blue', width: 61, height: 61, anchor: [30, 59] },
      { id: 'decor_table_low_square_lavender', label: 'Lavender', width: 61, height: 61, anchor: [30, 59] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 3, footprintV: 3,
      anchorRule: 'front-base', anchorNote: 'Front leg/base reference',
      artworkEnvelope: {"left": -30, "top": -59, "right": 31, "bottom": 2} },
  },
  {
    id: 'decor_tin_round', displayName: 'Cat Food Tin', category: 'Feeding',
    defaultVariantId: 'decor_tin_round_red',
    variants: [
      { id: 'decor_tin_round_red', label: 'Red', width: 18, height: 18, anchor: [9, 17] },
      { id: 'decor_tin_round_sand', label: 'Sand', width: 18, height: 18, anchor: [9, 17] },
      { id: 'decor_tin_round_grey', label: 'Grey', width: 18, height: 18, anchor: [9, 17] },
      { id: 'decor_tin_round_pink', label: 'Pink', width: 18, height: 18, anchor: [9, 17] },
      { id: 'decor_tin_round_purple', label: 'Purple', width: 18, height: 18, anchor: [9, 17] },
      { id: 'decor_tin_round_green', label: 'Green', width: 18, height: 18, anchor: [9, 17] },
      { id: 'decor_tin_round_navy', label: 'Navy', width: 18, height: 18, anchor: [9, 17] },
      { id: 'decor_tin_round_teal', label: 'Teal', width: 18, height: 18, anchor: [9, 17] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 1, footprintV: 1,
      anchorRule: 'front-base', anchorNote: 'Closed tin floor contact',
      artworkEnvelope: {"left": -9, "top": -17, "right": 9, "bottom": 1} },
  },
  {
    id: 'decor_toy_block', displayName: 'Toy Block', category: 'Toys',
    defaultVariantId: 'decor_toy_block_multicolor',
    variants: [
      { id: 'decor_toy_block_multicolor', label: 'Multicolor', width: 19, height: 18, anchor: [9.5, 17] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 1, footprintV: 1,
      anchorRule: 'front-base', anchorNote: 'One fixed multicolor baseline; no rotations',
      artworkEnvelope: {"left": -9.5, "top": -17, "right": 9.5, "bottom": 1} },
  },
  {
    id: 'decor_toy_bone', displayName: 'Bone Toy', category: 'Toys',
    defaultVariantId: 'decor_toy_bone_tan',
    variants: [
      { id: 'decor_toy_bone_tan', label: 'Tan', width: 18, height: 10, anchor: [9, 9] },
      { id: 'decor_toy_bone_cream', label: 'Cream', width: 18, height: 10, anchor: [9, 9] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 1, footprintV: 1,
      anchorRule: 'front-base', anchorNote: 'Bone floor contact',
      artworkEnvelope: {"left": -9, "top": -9, "right": 9, "bottom": 1} },
  },
  {
    id: 'decor_toy_mouse_plush', displayName: 'Plush Mouse', category: 'Toys',
    defaultVariantId: 'decor_toy_mouse_plush_brown',
    variants: [
      { id: 'decor_toy_mouse_plush_brown', label: 'Brown', width: 52, height: 33, anchor: [18, 25] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 2, footprintV: 1,
      anchorRule: 'front-base', anchorNote: 'Body base excludes tail from occupancy',
      artworkEnvelope: {"left": -18, "top": -25, "right": 34, "bottom": 8} },
  },
  {
    id: 'decor_cat_perch_tall', displayName: 'Tall Cat Perch', category: 'Cat Furniture',
    defaultVariantId: 'decor_cat_perch_tall_cream',
    variants: [
      { id: 'decor_cat_perch_tall_cream', label: 'Cream', width: 33, height: 90, anchor: [16, 89] },
      { id: 'decor_cat_perch_tall_mint', label: 'Mint', width: 33, height: 90, anchor: [16, 89] },
      { id: 'decor_cat_perch_tall_blue', label: 'Blue', width: 33, height: 90, anchor: [16, 89] },
      { id: 'decor_cat_perch_tall_lavender', label: 'Lavender', width: 33, height: 90, anchor: [16, 89] },
      { id: 'decor_cat_perch_tall_rose', label: 'Rose', width: 33, height: 90, anchor: [16, 89] },
      { id: 'decor_cat_perch_tall_peach', label: 'Peach', width: 33, height: 90, anchor: [16, 89] },
    ],
    floor: { surface: 'floor', nativeScale: 1, footprintU: 1, footprintV: 1,
      anchorRule: 'front-base', anchorNote: 'Bottom stem contact, not raised platforms',
      artworkEnvelope: {"left": -16, "top": -89, "right": 17, "bottom": 1} },
  },
 ] as const satisfies readonly FloorDecorationDefinition[];

export type FloorProductId = typeof floorDecorations[number]['id'];
export type FloorVariantId = typeof floorDecorations[number]['variants'][number]['id'];

// Reserve earlier persisted placeholders forever. They are read compatibility aliases,
// excluded from new-purchase defaults and selectable finish lists. No data rewrite needed.
export const legacyFloorVariantAliases: Readonly<Record<string, FloorVariantId>> = {
  'decor_yarn_ball_base': 'decor_yarn_ball_sage',
  'decor_cat_tree_multilevel_base': 'decor_cat_tree_multilevel_cream',
  'decor_cat_bed_cushioned_base': 'decor_cat_bed_cushioned_blue',
  'decor_plant_small_potted_base': 'decor_plant_small_potted_rose',
  'decor_cat_tower_stair_base': 'decor_cat_tower_stair_honey',
  'decor_bookshelf_open_base': 'decor_bookshelf_open_peach',
  'decor_plant_large_potted_base': 'decor_plant_large_potted_brown',
  'decor_scratching_post_round_base': 'decor_scratching_post_round_cream',
  'decor_bowl_base': 'decor_bowl_blue',
  'decor_cat_perch_double_base': 'decor_cat_perch_double_cream',
  'decor_table_low_square_base': 'decor_table_low_square_cream',
  'decor_tin_round_base': 'decor_tin_round_red',
  'decor_toy_block_base': 'decor_toy_block_multicolor',
  'decor_toy_bone_base': 'decor_toy_bone_tan',
  'decor_toy_mouse_plush_base': 'decor_toy_mouse_plush_brown',
  'decor_cat_perch_tall_base': 'decor_cat_perch_tall_cream',
};

export function floorDecoration(productId: string): FloorDecorationDefinition | undefined {
  return floorDecorations.find(product => product.id === productId);
}

export function resolveFloorVariant(product: FloorDecorationDefinition, variantId: string): FloorVariantDefinition | undefined {
  const id = Object.hasOwn(legacyFloorVariantAliases, variantId) ? legacyFloorVariantAliases[variantId] : variantId;
  return product.variants.find(variant => variant.id === id);
}
