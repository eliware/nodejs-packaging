Name:           eliware-nodejs26
Version:        %{node_version}
Release:        %{npm_release}%{?dist}
Summary:        Eliware Node.js 26 JavaScript runtime
License:        MIT AND Apache-2.0 AND BSD-3-Clause
URL:            https://nodejs.org/
Source0:        node-v%{version}-linux-x64.tar.xz
Source1:        npm-%{npm_version}.tgz
BuildArch:      x86_64
%global debug_package %{nil}
%global __os_install_post %{nil}

%description
Node.js 26 runtime from the official precompiled Linux x64 release with npm %{npm_version}.

%prep
%setup -q -n node-v%{version}-linux-x64

%build
# Install the verified npm package in the extracted tree before RPM assembly.
./bin/node ./lib/node_modules/npm/bin/npm-cli.js install --global \
  --prefix "$PWD" --offline --no-audit --no-fund "%{SOURCE1}"

%install
install -d "%{buildroot}/opt/nodejs/26/%{version}"
cp -a . "%{buildroot}/opt/nodejs/26/%{version}/"
ln -s "%{version}" "%{buildroot}/opt/nodejs/26/current"
install -d "%{buildroot}%{_bindir}"
ln -s /opt/nodejs/26/current/bin/node "%{buildroot}%{_bindir}/node26"
cat > "%{buildroot}%{_bindir}/npm26" <<'EOF'
#!/bin/sh
prefix=/var/lib/eliware/nodejs26/global
npm_cli="$prefix/lib/node_modules/npm/bin/npm-cli.js"
if [ ! -f "$npm_cli" ]; then
  npm_cli=/opt/nodejs/26/current/lib/node_modules/npm/bin/npm-cli.js
fi
NPM_CONFIG_PREFIX="$prefix" PATH="$prefix/bin:/opt/nodejs/26/current/bin:$PATH" \
  exec /opt/nodejs/26/current/bin/node "$npm_cli" "$@"
EOF
cat > "%{buildroot}%{_bindir}/npx26" <<'EOF'
#!/bin/sh
prefix=/var/lib/eliware/nodejs26/global
npx_cli="$prefix/lib/node_modules/npm/bin/npx-cli.js"
if [ ! -f "$npx_cli" ]; then
  npx_cli=/opt/nodejs/26/current/lib/node_modules/npm/bin/npx-cli.js
fi
NPM_CONFIG_PREFIX="$prefix" PATH="$prefix/bin:/opt/nodejs/26/current/bin:$PATH" \
  exec /opt/nodejs/26/current/bin/node "$npx_cli" "$@"
EOF
chmod 0755 "%{buildroot}%{_bindir}/npm26" "%{buildroot}%{_bindir}/npx26"
install -d "%{buildroot}/etc/profile.d"
cat > "%{buildroot}/etc/profile.d/eliware-nodejs26.sh" <<'EOF'
export PATH="/var/lib/eliware/nodejs26/global/bin:$PATH"
export NPM_CONFIG_PREFIX="/var/lib/eliware/nodejs26/global"
EOF

%check
test "$(./bin/node --version)" = "v%{version}"
test "$(./bin/node ./lib/node_modules/npm/bin/npm-cli.js --version)" = "%{npm_version}"

%files
%dir /opt/nodejs/26
/opt/nodejs/26/current
/opt/nodejs/26/%{version}
%config(noreplace) /etc/profile.d/eliware-nodejs26.sh
%{_bindir}/node26
%{_bindir}/npm26
%{_bindir}/npx26

%changelog
* Thu Nov 19 2026 Eliware <eliware@eliware.org> - %{version}-%{npm_release}%{?dist}
- Repackage the official Node.js 26 Linux x64 binaries.
