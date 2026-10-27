namespace Uomd.Scenes
{
    public sealed class HomeScreen : RebuildHubScreen
    {
        public HomeScreen(UomdSceneRouter router) : base(router) { }
        public override Uomd.Core.UomdScreenId ScreenId => Uomd.Core.UomdScreenId.Home;
    }
    public sealed class ChaptersScreen : RebuildHubScreen
    {
        public ChaptersScreen(UomdSceneRouter router) : base(router) { }
        public override Uomd.Core.UomdScreenId ScreenId => Uomd.Core.UomdScreenId.Chapters;
    }
}
