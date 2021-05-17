cat >build/cmd-cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF

cat >build/cmd-esm/package.json <<!EOF
{
    "type": "module"
}
!EOF