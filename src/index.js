import ReproccerReborn from './reproccer-reborn';

ngapp.run((patcherService) => {
  patcherService.registerPatcher(new ReproccerReborn(fh, info));
});
