{
  inputs = {
    nixpkgs = {
      url = "github:nixos/nixpkgs/nixpkgs-unstable";
    };
  };

  outputs = {nixpkgs, ...}: let
    forAllSystems = f: nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed (system: f (pkgsFor system));
    pkgsFor = system:
      import nixpkgs {
        inherit system;
        # overlays = import ./nix/overlays {
        #   inherit system;
        #   inherit inputs;
        # };
        config = {
          allowUnfree = true;
        };
      };
  in {
    formatter = forAllSystems (pkgs: pkgs.alejandra);

    devShells = forAllSystems (
      pkgs: let
        shellHook = ''
          export LD_LIBRARY_PATH="$LD_LIBRARY_PATH:${pkgs.stdenv.cc.cc.lib}/lib";
        '';
      in {
        default = pkgs.mkShell {
          inherit shellHook;
          buildInputs = with pkgs; [watchman];
        };
      }
    );
  };
}
