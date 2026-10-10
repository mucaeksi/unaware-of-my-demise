[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 32755
unverified_code_nodes: 0
raw_edges: 58552
valid_candidate_edges: 58552
missing_endpoint_edges: 0
dangling_endpoint_edges: 0
external_reference_edges: 0
self_loop_edges: 190
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 53675
directed_same_endpoint_collapsed_edges: 4877
undirected_unique_endpoint_pairs: 53361
undirected_same_endpoint_collapsed_edges: 5191
same_endpoint_group_count: 2573
relation_variant_groups: 567
source_file_variant_groups: 0
source_location_variant_groups: 1994
context_variant_groups: 66
post_build_graph_type: DiGraph
post_build_edges: 53654
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
  - references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_phantomcamera3d_phantomcamera_methodname -> references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_phantomcamera3d_cs_stringname edges=73 relations=['references'] locations=['L365', 'L367', 'L368', 'L370', 'L371', 'L373', 'L374', 'L376', 'L377', 'L379', 'L380', 'L382', 'L383', 'L385', 'L386', 'L388', 'L389', 'L391', 'L392', 'L394', 'L395', 'L397', 'L398', 'L400', 'L401', 'L403', 'L404', 'L406', 'L407', 'L409', 'L411', 'L412', 'L414', 'L415', 'L417', 'L418', 'L420', 'L422', 'L423', 'L425', 'L426', 'L428', 'L429', 'L431', 'L432', 'L434', 'L435', 'L437', 'L438', 'L440', 'L441', 'L443', 'L444', 'L446', 'L447', 'L449', 'L450', 'L452', 'L453', 'L455', 'L456', 'L458', 'L459', 'L461', 'L462', 'L464', 'L465', 'L467', 'L468', 'L470', 'L471', 'L473', 'L474'] contexts=['field']
  - references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_phantomcamera2d_phantomcamera_methodname -> references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_phantomcamera2d_cs_stringname edges=48 relations=['references'] locations=['L285', 'L286', 'L288', 'L289', 'L291', 'L292', 'L294', 'L295', 'L297', 'L298', 'L300', 'L301', 'L303', 'L304', 'L306', 'L307', 'L309', 'L310', 'L312', 'L313', 'L315', 'L316', 'L318', 'L319', 'L321', 'L322', 'L324', 'L325', 'L327', 'L328', 'L330', 'L331', 'L333', 'L334', 'L336', 'L337', 'L339', 'L340', 'L342', 'L343', 'L345', 'L346', 'L348', 'L349', 'L351', 'L352', 'L354', 'L355'] contexts=['field']
  - references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_phantomcamera_phantomcamera_methodname -> references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_phantomcamera_cs_stringname edges=43 relations=['references'] locations=['L149', 'L150', 'L152', 'L153', 'L155', 'L157', 'L158', 'L160', 'L161', 'L163', 'L165', 'L166', 'L167', 'L169', 'L170', 'L172', 'L173', 'L175', 'L176', 'L178', 'L179', 'L181', 'L182', 'L184', 'L185', 'L187', 'L188', 'L190', 'L191', 'L193', 'L194', 'L196', 'L197', 'L199', 'L200', 'L202', 'L203', 'L205', 'L206', 'L207', 'L209', 'L210', 'L212'] contexts=['field']
  - references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_host_phantom_camera_host_phantomcamerahost__pcam_tween -> references_shared_godot_phantom_camera_addons_phantom_camera_scripts_phantom_camera_host_phantom_camera_host_phantomcamerahost__tween_interpolate_value edges=30 relations=['calls'] locations=['L1001', 'L1008', 'L1014', 'L1023', 'L1029', 'L1035', 'L1041', 'L1047', 'L1053', 'L1059', 'L1066', 'L1072', 'L1078', 'L1084', 'L1090', 'L1096', 'L1102', 'L1108', 'L1115', 'L1122', 'L1129', 'L1136', 'L1143', 'L1150', 'L1157', 'L955', 'L965', 'L969', 'L975', 'L995'] contexts=['_pcam_tween -> _tween_interpolate_value (same script)']
note: normal graph.json is post-build; raw producer loss must be measured earlier.

Distinct same-endpoint edges are intentionally preserved in graph.json MultiDiGraph; the simple-graph collapse simulation is a risk diagnostic, not loss in this export.
