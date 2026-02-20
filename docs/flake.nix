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
          packages = [
            pkgs.gnumake
            pkgs.git
            pkgs.tectonic
            pkgs.biber-for-tectonic
            pkgs.entr
          ];

          env = {
            TECTONIC_CACHE_DIR = "$HOME/.cache/Tectonic";
          };

          shellHook = ''
            echo "Dev shell: Tectonic + Auto-build enabled"
            
            # Alias to make it easy to start the watcher
            alias watch-build="find . -name '*.tex' -o -name 'Makefile' | entr make" [cite: 6]
            
            echo "-------------------------------------------------------"
            echo "To build automatically on save, run: watch-build"
            echo "-------------------------------------------------------"
          '';
        };
      });
  };
}