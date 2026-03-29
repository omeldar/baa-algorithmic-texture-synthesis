{
  description = "Texture Synthesis Lab - Next.js development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js 22 LTS
            nodejs_22
            
            # pnpm package manager
            pnpm
            
            # Optional: useful for development
            git
          ];

          shellHook = ''
            echo "Texture Synthesis Lab Development Environment"
            echo "Node.js: $(node --version)"
            echo "pnpm: $(pnpm --version)"
            echo ""
            
            # Install dependencies if node_modules doesn't exist
            if [ ! -d "node_modules" ]; then
              echo "Installing dependencies..."
              pnpm install
            fi
            
            echo "Run 'pnpm dev' to start the development server"
            echo "Open http://localhost:3000 in a WebGPU-capable browser (Chrome/Edge 113+)"
          '';
        };

        # Optional: package for building the project
        packages.default = pkgs.buildNpmPackage {
          pname = "texture-synthesis-lab";
          version = "0.1.0";
          src = ./.;
          
          npmDeps = pkgs.importNpmLock {
            npmRoot = ./.;
          };
          
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;
          
          buildPhase = ''
            pnpm build
          '';
          
          installPhase = ''
            mkdir -p $out
            cp -r .next $out/
            cp -r public $out/
            cp package.json $out/
          '';
        };
      }
    );
}