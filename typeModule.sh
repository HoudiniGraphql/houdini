cat >build/runtime-esm/package.json <<!EOF
{
    "type": "module"
}
!EOF
cat >build/preprocess-esm/package.json <<!EOF
{
    "type": "module"
}
!EOF
cat >build/package.json <<!EOF
{
    "type": "module"
}
!EOF
cat >build/vite-esm/package.json <<!EOF
{
    "type": "module"
}
!EOF
cat >build/runtime-cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF
cat >build/preprocess-cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF
cat >build/vite-cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF