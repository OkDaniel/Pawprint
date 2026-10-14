import { floorDecoration, resolveFloorVariant, type FloorVariantId } from '@capstone/shared';
import asset0 from './assets/room_decor_003_v01.png';
import asset1 from './assets/room_decor_003_v02.png';
import asset2 from './assets/room_decor_003_v03.png';
import asset3 from './assets/room_decor_003_v04.png';
import asset4 from './assets/room_decor_003_v05.png';
import asset5 from './assets/room_decor_003_v06.png';
import asset6 from './assets/room_decor_003_v07.png';
import asset7 from './assets/room_decor_003_v08.png';
import asset8 from './assets/room_decor_003_v09.png';
import asset9 from './assets/room_decor_003_v10.png';
import asset10 from './assets/room_decor_003_v11.png';
import asset11 from './assets/room_decor_003_v12.png';
import asset12 from './assets/room_decor_006_v01.png';
import asset13 from './assets/room_decor_006_v02.png';
import asset14 from './assets/room_decor_006_v03.png';
import asset15 from './assets/room_decor_007_v01.png';
import asset16 from './assets/room_decor_007_v02.png';
import asset17 from './assets/room_decor_007_v03.png';
import asset18 from './assets/room_decor_007_v04.png';
import asset19 from './assets/room_decor_007_v05.png';
import asset20 from './assets/room_decor_007_v06.png';
import asset21 from './assets/room_decor_008_v01.png';
import asset22 from './assets/room_decor_008_v02.png';
import asset23 from './assets/room_decor_008_v03.png';
import asset24 from './assets/room_decor_008_v04.png';
import asset25 from './assets/room_decor_008_v05.png';
import asset26 from './assets/room_decor_008_v06.png';
import asset27 from './assets/room_decor_013_v01.png';
import asset28 from './assets/room_decor_013_v02.png';
import asset29 from './assets/room_decor_014_v01.png';
import asset30 from './assets/room_decor_014_v02.png';
import asset31 from './assets/room_decor_014_v03.png';
import asset32 from './assets/room_decor_014_v04.png';
import asset33 from './assets/room_decor_014_v05.png';
import asset34 from './assets/room_decor_015_v01.png';
import asset35 from './assets/room_decor_015_v02.png';
import asset36 from './assets/room_decor_015_v03.png';
import asset37 from './assets/room_decor_015_v04.png';
import asset38 from './assets/room_decor_018_v01.png';
import asset39 from './assets/room_decor_018_v02.png';
import asset40 from './assets/room_decor_019_v13.png';
import asset41 from './assets/room_decor_019_v14.png';
import asset42 from './assets/room_decor_019_v15.png';
import asset43 from './assets/room_decor_019_v16.png';
import asset44 from './assets/room_decor_019_v17.png';
import asset45 from './assets/room_decor_019_v18.png';
import asset46 from './assets/room_decor_020_v01.png';
import asset47 from './assets/room_decor_020_v02.png';
import asset48 from './assets/room_decor_020_v03.png';
import asset49 from './assets/room_decor_020_v04.png';
import asset50 from './assets/room_decor_020_v05.png';
import asset51 from './assets/room_decor_022_v01.png';
import asset52 from './assets/room_decor_022_v02.png';
import asset53 from './assets/room_decor_022_v03.png';
import asset54 from './assets/room_decor_022_v04.png';
import asset55 from './assets/room_decor_022_v05.png';
import asset56 from './assets/room_decor_023_v01.png';
import asset57 from './assets/room_decor_023_v02.png';
import asset58 from './assets/room_decor_023_v03.png';
import asset59 from './assets/room_decor_023_v04.png';
import asset60 from './assets/room_decor_023_v05.png';
import asset61 from './assets/room_decor_023_v06.png';
import asset62 from './assets/room_decor_023_v07.png';
import asset63 from './assets/room_decor_023_v08.png';
import asset64 from './assets/room_decor_024_v01.png';
import asset65 from './assets/room_decor_026_v01.png';
import asset66 from './assets/room_decor_026_v02.png';
import asset67 from './assets/room_decor_027_v01.png';
import asset68 from './assets/room_decor_028_v01.png';
import asset69 from './assets/room_decor_028_v02.png';
import asset70 from './assets/room_decor_028_v03.png';
import asset71 from './assets/room_decor_028_v04.png';
import asset72 from './assets/room_decor_028_v05.png';
import asset73 from './assets/room_decor_028_v06.png';

// Explicit semantic mapping: never infer persistence identity from filenames.
export const floorVariantAssets = {
  'decor_yarn_ball_sage': asset0,
  'decor_yarn_ball_slate': asset1,
  'decor_yarn_ball_sky_blue': asset2,
  'decor_yarn_ball_cream': asset3,
  'decor_yarn_ball_red': asset4,
  'decor_yarn_ball_grey': asset5,
  'decor_yarn_ball_teal': asset6,
  'decor_yarn_ball_indigo': asset7,
  'decor_yarn_ball_plum': asset8,
  'decor_yarn_ball_olive': asset9,
  'decor_yarn_ball_gold': asset10,
  'decor_yarn_ball_purple': asset11,
  'decor_cat_tree_multilevel_cream': asset12,
  'decor_cat_tree_multilevel_aqua': asset13,
  'decor_cat_tree_multilevel_lavender': asset14,
  'decor_cat_bed_cushioned_blue': asset15,
  'decor_cat_bed_cushioned_grey': asset16,
  'decor_cat_bed_cushioned_rose': asset17,
  'decor_cat_bed_cushioned_olive': asset18,
  'decor_cat_bed_cushioned_purple': asset19,
  'decor_cat_bed_cushioned_teal': asset20,
  'decor_plant_small_potted_rose': asset21,
  'decor_plant_small_potted_grey': asset22,
  'decor_plant_small_potted_cream': asset23,
  'decor_plant_small_potted_blue': asset24,
  'decor_plant_small_potted_lime': asset25,
  'decor_plant_small_potted_indigo': asset26,
  'decor_cat_tower_stair_honey': asset27,
  'decor_cat_tower_stair_cream': asset28,
  'decor_bookshelf_open_peach': asset29,
  'decor_bookshelf_open_blue': asset30,
  'decor_bookshelf_open_sage': asset31,
  'decor_bookshelf_open_purple': asset32,
  'decor_bookshelf_open_sand': asset33,
  'decor_plant_large_potted_brown': asset34,
  'decor_plant_large_potted_navy': asset35,
  'decor_plant_large_potted_plum': asset36,
  'decor_plant_large_potted_blue': asset37,
  'decor_scratching_post_round_cream': asset38,
  'decor_scratching_post_round_brown': asset39,
  'decor_bowl_blue': asset40,
  'decor_bowl_sand': asset41,
  'decor_bowl_purple': asset42,
  'decor_bowl_white': asset43,
  'decor_bowl_rose': asset44,
  'decor_bowl_sage': asset45,
  'decor_cat_perch_double_cream': asset46,
  'decor_cat_perch_double_peach': asset47,
  'decor_cat_perch_double_blue': asset48,
  'decor_cat_perch_double_rose': asset49,
  'decor_cat_perch_double_sage': asset50,
  'decor_table_low_square_cream': asset51,
  'decor_table_low_square_grey': asset52,
  'decor_table_low_square_rose': asset53,
  'decor_table_low_square_blue': asset54,
  'decor_table_low_square_lavender': asset55,
  'decor_tin_round_red': asset56,
  'decor_tin_round_sand': asset57,
  'decor_tin_round_grey': asset58,
  'decor_tin_round_pink': asset59,
  'decor_tin_round_purple': asset60,
  'decor_tin_round_green': asset61,
  'decor_tin_round_navy': asset62,
  'decor_tin_round_teal': asset63,
  'decor_toy_block_multicolor': asset64,
  'decor_toy_bone_tan': asset65,
  'decor_toy_bone_cream': asset66,
  'decor_toy_mouse_plush_brown': asset67,
  'decor_cat_perch_tall_cream': asset68,
  'decor_cat_perch_tall_mint': asset69,
  'decor_cat_perch_tall_blue': asset70,
  'decor_cat_perch_tall_lavender': asset71,
  'decor_cat_perch_tall_rose': asset72,
  'decor_cat_perch_tall_peach': asset73,
} satisfies Record<FloorVariantId, string>;

// Works for owned disabled/retired products and historical _base inventory too.
export function floorDecorationAsset(productId: string, variantId: string): string | undefined {
  const product = floorDecoration(productId);
  const variant = product && resolveFloorVariant(product, variantId);
  return variant ? floorVariantAssets[variant.id as FloorVariantId] : undefined;
}
