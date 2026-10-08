[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 25110
unverified_code_nodes: 0
raw_edges: 49357
valid_candidate_edges: 49357
missing_endpoint_edges: 0
dangling_endpoint_edges: 0
external_reference_edges: 0
self_loop_edges: 157
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 43969
directed_same_endpoint_collapsed_edges: 5388
undirected_unique_endpoint_pairs: 43781
undirected_same_endpoint_collapsed_edges: 5576
same_endpoint_group_count: 2729
relation_variant_groups: 343
source_file_variant_groups: 0
source_location_variant_groups: 2388
context_variant_groups: 26
post_build_graph_type: DiGraph
post_build_edges: 43962
producer_suppression_sites: 12
producer_suppression_examples:
  - L1749 seen_ids arity=unknown
  - L2282 seen_ids arity=unknown
  - L2284 seen_doc_refs arity=unknown
  - L2762 seen_ids arity=unknown
  - L2909 seen_ids arity=unknown
  - L3708 seen_keys arity=unknown
  - L3881 seen_keys arity=unknown
  - L6088 seen_ids arity=unknown
examples:
  - agents_archive_20261008_sources_claude_docs_effects_map -> project edges=73 relations=['references'] locations=['L1027', 'L107', 'L1081', 'L112', 'L1171', 'L1221', 'L1250', 'L1283', 'L129', 'L1344', 'L1386', 'L1430', 'L1476', 'L1523', 'L1579', 'L1581', 'L1619', 'L1621', 'L1673', 'L1710', 'L1760', 'L177', 'L182', 'L184', 'L1847', 'L1871', 'L1896', 'L1962', 'L1996', 'L204', 'L206', 'L207', 'L2080', 'L214', 'L2164', 'L2211', 'L2212', 'L2213', 'L2244', 'L225', 'L2250', 'L2274', 'L228', 'L2287', 'L2288', 'L2294', 'L2301', 'L2302', 'L2303', 'L2320', 'L2444', 'L26', 'L274', 'L290', 'L295', 'L309', 'L317', 'L321', 'L334', 'L42', 'L45', 'L467', 'L47', 'L496', 'L498', 'L536', 'L66', 'L69', 'L709', 'L783', 'L81', 'L99', 'L992'] contexts=['document_path_reference']
  - game_scripts_core_battle_effect_interpreter_effectinterpreter_resolve_selector -> game_scripts_core_battle_battle_unit_battleunit edges=44 relations=['references_type'] locations=['L497', 'L498', 'L506', 'L510', 'L512', 'L519', 'L522', 'L523', 'L528', 'L529', 'L534', 'L539', 'L540', 'L542', 'L557', 'L565', 'L569', 'L570', 'L575', 'L579', 'L580', 'L587', 'L589', 'L590', 'L595', 'L596', 'L604', 'L607', 'L611', 'L615', 'L619', 'L624', 'L625', 'L626', 'L632', 'L635', 'L636', 'L640', 'L641', 'L647', 'L653', 'L654', 'L657', 'L658'] contexts=['explicit project type BattleUnit']
  - game_tests_parity_test_battle_hooks_unit_test_authored_event_hooks_dispatch_with_conditions_and_limits -> game_scripts_core_battle_battle_unit_battleunit edges=24 relations=['references_type'] locations=['L103', 'L105', 'L109', 'L113', 'L119', 'L123', 'L128', 'L140', 'L144', 'L150', 'L152', 'L154', 'L160', 'L165', 'L173', 'L174', 'L187', 'L195', 'L208', 'L88', 'L89', 'L90', 'L92', 'L99'] contexts=['explicit project type BattleUnit']
  - game_scripts_ui_entry_entry_screen_entryscreen__build -> game_scripts_ui_common_ui_kit_uikit edges=23 relations=['references_type'] locations=['L102', 'L105', 'L115', 'L118', 'L127', 'L128', 'L133', 'L140', 'L142', 'L144', 'L148', 'L152', 'L64', 'L66', 'L69', 'L72', 'L77', 'L81', 'L85', 'L87', 'L90', 'L93', 'L99'] contexts=['explicit project type UiKit']
  - game_addons_godot_ai_runtime_game_helper__variant_to_json -> game_addons_godot_ai_runtime_game_helper__variant_to_json edges=21 relations=['calls'] locations=['L1278', 'L1279', 'L1280', 'L1284', 'L1285', 'L1289', 'L1290', 'L1291', 'L1295', 'L1296', 'L1300', 'L1301', 'L1305', 'L1306', 'L1312', 'L1317', 'L1318', 'L1319', 'L1320', 'L1359', 'L1364'] contexts=['_variant_to_json -> _variant_to_json (same script)']
note: normal graph.json is post-build; raw producer loss must be measured earlier.

Distinct same-endpoint edges are intentionally preserved in graph.json MultiDiGraph; the simple-graph collapse simulation is a risk diagnostic, not loss in this export.
