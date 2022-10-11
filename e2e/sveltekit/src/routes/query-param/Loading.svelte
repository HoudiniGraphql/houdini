<!-- <span class="">One eternity later...</span> -->

<span class="gradient element">One eternity later...</span>

<style>
  .element {
    width: fit-content;
    padding-right: 40px;
  }

  .gradient {
    animation-duration: 0.8s;
    animation-fill-mode: forwards;
    animation-iteration-count: infinite;
    animation-name: placeHolderShimmer;
    animation-timing-function: linear;
    background: #f6f7f8;
    background: linear-gradient(to right, #fafafa 8%, #f4f4f4 38%, #ff3e00 80%);
    background-size: 1000px 640px;

    position: relative;
  }

  @keyframes placeHolderShimmer {
    0% {
      background-position: -468px 0;
    }
    100% {
      background-position: 468px 0;
    }
  }
</style>
