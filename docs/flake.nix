{
  description = "BAA thesis dev shell (tectonic + biber-for-tectonic + make + auto-build)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

  outputs = { self, nixpkgs }:
  let
    systems = [ "x86_64-linux" "aarch64-linux" ];
    forAll = f: builtins.listToAttrs (map (s: { name = s; value = f s; }) systems);
  in {
    devShells = forAll (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        default = pkgs.mkShell {
          packages = with pkgs; [
            gnumake
            git
            tectonic
            entr
          ];

          TECTONIC_CACHE_DIR = "$HOME/.cache/Tectonic";

          shellHook = ''
            echo "Dev shell: Thesis documentation environment"

            alias watch-build="find . -name '*.tex' -o -name 'Makefile' | entr -c make"

            echo "Manual build: make"
            echo "Auto build:   watch-build"
          '';
        };
      });
  };
}