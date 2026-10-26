using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Uomd.Core;
using Uomd.Scenes;
using UnityEngine;

namespace Uomd.EditorTools
{
    public sealed class ProductionReviewAsset
    {
        public string Id, Class, Provider, SourcePath, SourceSha, EntryPath, EntrySha, PromptPath, ProvenancePath;
        public int Revision, Width, Height;
        public bool Candidate;
        public string HumanState, Details, PreviewPath, OutputPreviewPath;
        public object Entry;
        public string Identity => Id + "@" + Revision + ":" + SourceSha;
        public string Scenario => Id == "sol_title_key_art_01" ? "title" : Id == "sol_studio_mark" ? "studio"
            : Id == "sol_fadyme_vn_composed" ? "portrait/fadyme" : Id == "sol_mahmut_vn_composed" ? "portrait/mahmut"
            : Id.StartsWith("sol_fadyme_vn_", StringComparison.Ordinal) ? "portrait/fadyme/" + Id.Substring("sol_fadyme_vn_".Length)
            : Id.StartsWith("sol_mahmut_vn_", StringComparison.Ordinal) ? "portrait/mahmut/" + Id.Substring("sol_mahmut_vn_".Length)
            : Id == "sol_bg_forest_whispering_ash" ? "story/tutorial_t1_before"
            : Id == "sol_bg_forgotten_stone_crossing" ? "story/tutorial_t2_before"
            : Id == "sol_bg_shelter_courtyard_dusk" ? "story/tutorial_t3_before"
            : Id.StartsWith("sol_prologue_", StringComparison.Ordinal) ? "prologue/" + Id.Substring(13) : "";
    }

    /// <summary>Read-only projection of ingest records and the replacement inventory; never an approval ledger.</summary>
    public static class ProductionReviewCatalog
    {
        public static string RepositoryRoot => Path.GetFullPath(Path.Combine(Application.dataPath, "../../.."));
        public static string Resolve(string root, string relative)
        {
            if (string.IsNullOrWhiteSpace(relative) || relative.IndexOf(':') >= 0) throw new ArgumentException("Expected a repository-relative path.");
            relative = relative.Replace('\\', '/');
            if (Path.IsPathRooted(relative)) throw new ArgumentException("Expected a repository-relative path.");
            string full = Path.GetFullPath(Path.Combine(root, relative));
            if (!full.StartsWith(Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.Ordinal))
                throw new ArgumentException("Path leaves the repository.");
            return full;
        }

        public static List<ProductionReviewAsset> Load(string root)
        {
            var assets = new List<ProductionReviewAsset>();
            var inventory = UomdJson.ParseObject(File.ReadAllText(Resolve(root, "docs/media/SOL_VISUAL_REBUILD.json")));
            var obligations = JsonRead.Arr(inventory, "assets");
            var decodable = UomdJson.ParseObject(File.ReadAllText(Resolve(root, "apps/unity/Assets/StreamingAssets/uomd_base/decodable.json")));
            foreach (string file in Directory.GetFiles(Resolve(root, "content/approved_art/entries"), "*.json").OrderBy(p => p, StringComparer.Ordinal))
            {
                var entry = UomdJson.ParseObject(File.ReadAllText(file));
                var source = JsonRead.Get(entry, "source");
                var a = new ProductionReviewAsset
                {
                    Id = JsonRead.Str(entry, "asset_id"), Class = JsonRead.Str(entry, "class"), Revision = (int)JsonRead.Int(entry, "revision"),
                    SourceSha = JsonRead.Str(source, "sha256"), Width = (int)JsonRead.Int(source, "width"), Height = (int)JsonRead.Int(source, "height"),
                    ProvenancePath = JsonRead.Str(source, "provenance_file"), EntryPath = file.Substring(root.Length + 1).Replace('\\', '/'),
                    EntrySha = Sha256Hash.ComputeFileHex(file), Entry = entry,
                    HumanState = JsonRead.Str(JsonRead.Get(JsonRead.Get(entry, "qc"), "human"), "status", "unknown")
                };
                object provenance = null;
                if (a.ProvenancePath.Length > 0 && File.Exists(Resolve(root, a.ProvenancePath)))
                    provenance = UomdJson.ParseObject(File.ReadAllText(Resolve(root, a.ProvenancePath)));
                a.Provider = JsonRead.Str(provenance, "provider", JsonRead.Str(source, "model", "unknown"));
                a.Candidate = JsonRead.Str(JsonRead.Get(entry, "license"), "origin") == "openai_generated_output";
                foreach (var output in JsonRead.Arr(provenance, "outputs"))
                    if (JsonRead.Str(output, "sha256") == a.SourceSha) a.SourcePath = JsonRead.Str(output, "file");
                a.PromptPath = JsonRead.Str(JsonRead.Get(provenance, "spec"), "prompt_file");
                string firstOutput = JsonRead.Arr(entry, "outputs").Select(o => JsonRead.Str(o, "path")).FirstOrDefault();
                if (firstOutput != null && decodable.TryGetValue(firstOutput, out var runtimeImage))
                    a.OutputPreviewPath = "apps/unity/Assets/StreamingAssets/uomd_base/" + runtimeImage;
                a.PreviewPath = a.SourcePath;
                if (string.IsNullOrEmpty(a.PreviewPath))
                {
                    a.PreviewPath = a.OutputPreviewPath;
                }
                var mapped = obligations.Where(o => JsonRead.Str(o, "id") == a.Id || JsonRead.Str(o, "replacement_asset_id") == a.Id).ToArray();
                a.Details = (a.Candidate ? "OPENAI INTEGRATION CANDIDATE — final resolution/device gates open" : "HISTORICAL REFERENCE ONLY — rebuild replacement pending")
                    + "\n\nStable identity: " + a.Identity + "\nEntry: " + a.EntryPath + "\nEntry SHA-256: " + a.EntrySha
                    + "\nProvider: " + a.Provider + "\nNative source: " + a.Width + " × " + a.Height + "\nSource: " + a.SourcePath
                    + "\nProvenance: " + a.ProvenancePath + "\nPrompt: " + a.PromptPath
                    + "\n\nQC (ingest authority):\n" + CanonicalJson.Serialize(JsonRead.Get(entry, "qc"))
                    + "\n\nExact references:\n" + CanonicalJson.Serialize(JsonRead.Get(source, "references"))
                    + "\n\nActual manifest consumers:\n" + CanonicalJson.Serialize(JsonRead.Get(entry, "targets"))
                    + "\n\nReplacement obligations / owner feedback:\n" + CanonicalJson.Serialize(mapped.ToList());
                assets.Add(a);
            }
            foreach (var obligation in obligations.Where(o => JsonRead.Str(o, "reference_path").Length > 0))
            {
                string path = JsonRead.Str(obligation, "reference_path");
                assets.Add(new ProductionReviewAsset { Id = JsonRead.Str(obligation, "id"), Class = JsonRead.Str(obligation, "class"),
                    SourcePath = path, PreviewPath = path, Provider = "historical / no ingest entry", HumanState = "unverified", Entry = obligation,
                    Details = "HISTORICAL RUNTIME / STORE REFERENCE — no replacement acceptance\n" + CanonicalJson.Serialize(obligation) });
            }
            return assets.OrderByDescending(a => a.Candidate).ThenBy(a => a.Id, StringComparer.Ordinal).ToList();
        }

        public static void VerifyTarget(string root, ProductionReviewAsset asset)
        {
            if (!string.IsNullOrEmpty(asset.EntryPath) && Sha256Hash.ComputeFileHex(Resolve(root, asset.EntryPath)) != asset.EntrySha)
                throw new InvalidOperationException("The ingest revision changed. Reload before recording a review.");
            if (string.IsNullOrEmpty(asset.SourcePath) || !File.Exists(Resolve(root, asset.SourcePath)))
                throw new FileNotFoundException("The exact source revision is unavailable; review cannot bind a substitute.");
            string actual = Sha256Hash.ComputeFileHex(Resolve(root, asset.SourcePath));
            if (!string.IsNullOrEmpty(asset.SourceSha) && actual != asset.SourceSha) throw new InvalidOperationException("Source hash mismatch. Reload / repair provenance first.");
        }
    }

    [Serializable]
    public sealed class ProductionReviewRecord
    {
        public string id, createdAt, kind, assetId, sourceSha, entrySha, scenario, lineId, request, outcome;
        public int revision;
        public string[] captures = Array.Empty<string>();
        public RebuildShotSettings presentation;
    }

    [Serializable]
    public sealed class ProductionReviewIndex
    {
        public int schema = 1;
        public List<ProductionReviewRecord> requests = new List<ProductionReviewRecord>();
        public List<ProductionReviewCapture> captures = new List<ProductionReviewCapture>();
    }

    [Serializable]
    public sealed class ProductionReviewCapture
    {
        public string id, image, sha256, metadata, scenario, lineId;
    }

    /// <summary>Scene feedback and capture links only. Human art acceptance stays in ingest_art.</summary>
    public sealed class ProductionReviewStore
    {
        public readonly string Root;
        public string IndexPath => ProductionReviewCatalog.Resolve(Root, "docs/review/PRODUCTION_REVIEW.json");
        public ProductionReviewStore(string root) => Root = root;
        public ProductionReviewIndex Read()
        {
            var index = File.Exists(IndexPath) ? JsonUtility.FromJson<ProductionReviewIndex>(File.ReadAllText(IndexPath)) : new ProductionReviewIndex();
            foreach (var capture in index.captures)
            {
                if (!string.IsNullOrEmpty(capture.lineId) || string.IsNullOrEmpty(capture.metadata)) continue;
                string path = ProductionReviewCatalog.Resolve(Root, "docs/review/" + capture.metadata);
                if (File.Exists(path)) capture.lineId = JsonRead.Str(UomdJson.ParseObject(File.ReadAllText(path)), "lineId");
            }
            return index;
        }
        public void Write(ProductionReviewIndex index)
        {
            AtomicWrite(IndexPath, JsonUtility.ToJson(index, true) + "\n");
            var html = new StringBuilder("<!doctype html><meta charset=\"utf-8\"><title>UOMD Production Review</title><style>body{background:#18131f;color:#eee2ce;font:16px system-ui;max-width:1200px;margin:40px auto}img{max-width:100%}article{margin-bottom:48px}a{color:#c9b2e0}</style><h1>Production Review</h1><p>Local Editor evidence. No device, release or art approval is implied.</p>");
            foreach (var capture in index.captures)
                html.Append("<article><h2>").Append(System.Net.WebUtility.HtmlEncode(capture.scenario)).Append("</h2><a href=\"").Append(capture.metadata).Append("\">Metadata</a><p><img src=\"").Append(capture.image).Append("\"></p><code>").Append(capture.sha256).Append("</code></article>");
            AtomicWrite(ProductionReviewCatalog.Resolve(Root, "docs/review/index.html"), html.ToString());
        }

        public ProductionReviewRecord AddRequest(ProductionReviewAsset asset, string scenario, string lineId, string text, string kind, RebuildShotSettings settings)
        {
            if (string.IsNullOrWhiteSpace(text)) throw new ArgumentException("Write a precise request first.");
            if (kind != "revision_requested" && kind != "agent_qc_note") throw new ArgumentException("This index cannot grant art approvals.");
            ProductionReviewCatalog.VerifyTarget(Root, asset);
            var index = Read();
            var record = new ProductionReviewRecord { id = Guid.NewGuid().ToString("N"), createdAt = DateTime.UtcNow.ToString("o"), kind = kind,
                assetId = asset.Id, revision = asset.Revision, sourceSha = Sha256Hash.ComputeFileHex(ProductionReviewCatalog.Resolve(Root, asset.SourcePath)),
                entrySha = asset.EntrySha, scenario = scenario, lineId = lineId, request = text, outcome = "open",
                presentation = JsonUtility.FromJson<RebuildShotSettings>(JsonUtility.ToJson(settings)),
                captures = index.captures.Where(c => c.scenario == scenario && (string.IsNullOrEmpty(lineId) || c.lineId == lineId))
                    .Select(c => c.id + ":" + c.sha256).ToArray() };
            index.requests.Add(record);
            Write(index);
            return record;
        }

        public void SaveDraft(RebuildShotSettings settings)
        {
            settings.Validate();
            string name = settings.scenario.Replace('/', '_');
            AtomicWrite(ProductionReviewCatalog.Resolve(Root, "docs/review/drafts/" + name + ".json"), JsonUtility.ToJson(settings, true) + "\n");
        }

        public RebuildShotSettings LoadDraft(string scenario)
        {
            string name = scenario.Replace('/', '_');
            var settings = JsonUtility.FromJson<RebuildShotSettings>(File.ReadAllText(ProductionReviewCatalog.Resolve(Root, "docs/review/drafts/" + name + ".json")));
            settings.Validate();
            if (settings.scenario != scenario) throw new InvalidOperationException("This draft belongs to a different scenario.");
            return settings;
        }

        public void ApplyDraft(RebuildShotSettings settings)
        {
            settings.Validate();
            string path = ProductionReviewCatalog.Resolve(Root, "apps/unity/Assets/_UOMD/Resources/Rebuild/Presentation.json");
            string before = File.ReadAllText(path);
            var config = JsonUtility.FromJson<RebuildPresentationConfig>(before);
            var shots = config.shots.Where(s => s.scenario != settings.scenario).ToList();
            shots.Add(settings);
            config.shots = shots.ToArray();
            AtomicWrite(ProductionReviewCatalog.Resolve(Root, "docs/review/drafts/history/" + DateTime.UtcNow.ToString("yyyyMMddTHHmmssfff") + "_" + Guid.NewGuid().ToString("N") + ".json"), before);
            SaveDraft(settings);
            AtomicWrite(path, JsonUtility.ToJson(config, true) + "\n");
        }

        public static void AtomicWrite(string path, string text)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.WriteAllText(temporary, text.Replace("\r\n", "\n"), new UTF8Encoding(false));
            if (File.Exists(path)) File.Replace(temporary, path, null);
            else File.Move(temporary, path);
        }
    }
}
