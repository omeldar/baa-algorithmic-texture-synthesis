{
  description = "BAA thesis dev shell (tectonic + biber-for-tectonic + make + auto-build)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

  outputs = { self, nixpkgs }:
  let
    systems = [ "x86_64-linux" "aarch64-linux" ];
    forAll = f: builtins.listToAttrs (map (s: { name = s; value = f s; }) systems);
  in {

    # Development shell
    devShells = forAll (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        default = pkgs.mkShell {
          packages = with pkgs; [
            gnumake
            git
            tectonic
            biber-for-tectonic
            entr
          ];

          TECTONIC_CACHE_DIR = "$HOME/.cache/Tectonic";

          shellHook = ''
            echo "Dev shell: Thesis documentation environment"

            alias watch-build="find . -name '*.tex' -o -name 'Makefile' | entr -c make"

            echo "-------------------------------------------------------"
            echo "Manual build: make"
            echo "Auto build:   watch-build"
            echo "-------------------------------------------------------"
          '';
        };
      });

    # Clean build entrypoint for CI and local usage
    apps = forAll (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        build-docs = {
          type = "app";
          program = toString (pkgs.writeShellScript "build-docs" ''
            cd ${self}
            make
          '');
        };
      });
  };
}