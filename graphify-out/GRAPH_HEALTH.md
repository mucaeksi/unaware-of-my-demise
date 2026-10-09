[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 28819
unverified_code_nodes: 0
raw_edges: 52264
valid_candidate_edges: 52264
missing_endpoint_edges: 0
dangling_endpoint_edges: 0
external_reference_edges: 0
self_loop_edges: 189
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 47965
directed_same_endpoint_collapsed_edges: 4299
undirected_unique_endpoint_pairs: 47685
undirected_same_endpoint_collapsed_edges: 4579
same_endpoint_group_count: 2396
relation_variant_groups: 524
source_file_variant_groups: 0
source_location_variant_groups: 1861
context_variant_groups: 62
post_build_graph_type: DiGraph
post_build_edges: 47963
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
  - game_addons_godot_ai_runtime_game_helper__variant_to_json -> game_addons_godot_ai_runtime_game_helper__variant_to_json edges=21 relations=['calls'] locations=['L1278', 'L1279', 'L1280', 'L1284', 'L1285', 'L1289', 'L1290', 'L1291', 'L1295', 'L1296', 'L1300', 'L1301', 'L1305', 'L1306', 'L1312', 'L1317', 'L1318', 'L1319', 'L1320', 'L1359', 'L1364'] contexts=['_variant_to_json -> _variant_to_json (same script)']
  - game_addons_godot_ai_handlers_node_handler__coerce_value -> game_addons_godot_ai_handlers_node_handler__coerce_value edges=19 relations=['calls'] locations=['L1004', 'L1005', 'L1006', 'L1011', 'L1012', 'L1013', 'L1018', 'L1019', 'L1024', 'L1025', 'L1026', 'L1027', 'L981', 'L982', 'L987', 'L988', 'L993', 'L994', 'L999'] contexts=['_coerce_value -> _coerce_value (same script)']
  - agents_archive_20261008_sources_claude_skills_start_skill -> project edges=18 relations=['references'] locations=['L12', 'L15', 'L153', 'L154', 'L161', 'L163', 'L164', 'L167', 'L202', 'L21', 'L210', 'L250', 'L254', 'L274', 'L289', 'L292', 'L34', 'L48'] contexts=['document_path_reference']
  - game_addons_godot_ai_utils_variant_serializer_serialize -> game_addons_godot_ai_utils_variant_serializer_serialize edges=17 relations=['calls'] locations=['L56', 'L57', 'L60', 'L63', 'L64', 'L65', 'L69', 'L70', 'L71', 'L75', 'L76', 'L80', 'L81', 'L82', 'L83', 'L90', 'L95'] contexts=['serialize -> serialize (same script)']
note: normal graph.json is post-build; raw producer loss must be measured earlier.

Distinct same-endpoint edges are intentionally preserved in graph.json MultiDiGraph; the simple-graph collapse simulation is a risk diagnostic, not loss in this export.
